const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { execSync, spawn } = require('child_process');
const config = require('../config');
const pdfParse = require('pdf-parse');

const OCR_TIMEOUT = 60000; // 60 seconds per page

// 检查 Poppler 是否可用（用于 PDF 转图片）
function checkPopplerAvailable() {
  try {
    execSync('pdftoppm -v', { 
      stdio: ['ignore', 'pipe', 'pipe'], 
      timeout: 5000,
      encoding: 'utf8'
    });
    return true;
  } catch (error) {
    return false;
  }
}

// 获取 PDF 总页数
async function getPdfPageCount(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    return parsed.numpages || 1;
  } catch (error) {
    // 如果无法解析，默认返回1页
    return 1;
  }
}

// 直接使用 Poppler 转换 PDF 页面为图片
async function convertPdfPageWithPoppler(filePath, page, outputDir, outputPrefix) {
  return new Promise((resolve, reject) => {
    const outputBase = path.join(outputDir, outputPrefix);
    
    const pdftoppm = spawn('pdftoppm', [
      '-png',
      '-r', '200',  // 200 DPI
      '-f', page.toString(),
      '-l', page.toString(),
      filePath,
      outputBase
    ], {
      cwd: outputDir
    });

    let errorOutput = '';
    pdftoppm.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pdftoppm.on('close', (code) => {
      if (code === 0) {
        const expectedPath = path.join(outputDir, `${outputPrefix}-${page}.png`);
        if (fs.existsSync(expectedPath)) {
          resolve(expectedPath);
        } else {
          const files = fs.readdirSync(outputDir);
          const matchingFile = files.find(f => f.startsWith(outputPrefix) && f.endsWith('.png'));
          if (matchingFile) {
            resolve(path.join(outputDir, matchingFile));
          } else {
            reject(new Error(`Poppler 生成的文件不存在: ${expectedPath}`));
          }
        }
      } else {
        reject(new Error(`Poppler 转换失败 (exit code ${code}): ${errorOutput || '未知错误'}`));
      }
    });

    pdftoppm.on('error', (error) => {
      reject(new Error(`无法启动 Poppler: ${error.message}`));
    });
  });
}

// 使用阿里云 DashScope OCR API 识别图片中的文字（使用 qwen-vl-ocr 模型）
async function recognizeTextWithAliyunOCR(imagePath) {
  const apiKey = config.aliyunOcrApiKey || config.dashScopeKey;
  
  if (!apiKey) {
    throw new Error('OCR API Key 未配置。请在 .env 文件中配置 ALIYUN_OCR_API_KEY 或 DASHSCOPE_API_KEY。');
  }

  try {
    // 读取图片文件并转换为 base64
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    // 根据文件扩展名确定 MIME 类型
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

    // 使用阿里云 DashScope OpenAI 兼容 API
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model: 'qwen-vl-ocr-2025-04-13',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              },
              {
                type: 'text',
                text: '请仅输出图像中的文本内容。'
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: OCR_TIMEOUT
      }
    );

    // 解析 OCR 结果
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const message = response.data.choices[0].message;
      if (message && message.content) {
        return message.content.trim();
      }
    }

    throw new Error('OCR API 返回格式错误');
  } catch (error) {
    if (error.response) {
      throw new Error(`阿里云 OCR API 错误: ${error.response.status} - ${error.response.statusText || JSON.stringify(error.response.data)}`);
    }
    throw new Error(`OCR 识别失败: ${error.message}`);
  }
}

// 主函数：对 PDF 进行 OCR 识别
async function runOcrOnPdf(filePath, maxPages = 3) {
  // 检查 Poppler 是否可用
  const popplerAvailable = checkPopplerAvailable();
  if (!popplerAvailable) {
    throw new Error('OCR 功能需要安装 Poppler。请先安装 Poppler 并添加到 PATH 环境变量中。');
  }

  // 获取 PDF 实际页数
  const totalPages = await getPdfPageCount(filePath);
  const pagesToProcess = Math.min(maxPages, totalPages);

  if (pagesToProcess === 0) {
    return '';
  }

  const tempDir = path.join(path.dirname(filePath), `ocr_${Date.now()}`);
  await fs.ensureDir(tempDir);

  const textParts = [];
  
  try {
    for (let page = 1; page <= pagesToProcess; page += 1) {
      let imagePath = null;
      
      try {
        // 使用 Poppler 将 PDF 页面转换为图片
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Poppler 转换超时')), OCR_TIMEOUT)
        );
        const convertPromise = convertPdfPageWithPoppler(filePath, page, tempDir, 'ocr_page');
        imagePath = await Promise.race([convertPromise, timeoutPromise]);

        // 使用阿里云 OCR 识别图片中的文字
        const ocrPromise = recognizeTextWithAliyunOCR(imagePath);
        const ocrTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR 识别超时')), OCR_TIMEOUT)
        );
        
        const ocrText = await Promise.race([ocrPromise, ocrTimeoutPromise]);
        
        if (ocrText && ocrText.trim().length > 0) {
          textParts.push(ocrText.trim());
        }
      } catch (error) {
        // 如果第一页就失败，可能是配置问题，抛出错误
        if (page === 1 && textParts.length === 0) {
          throw new Error(`OCR 初始失败: ${error.message}`);
        }
        // 其他页失败时静默跳过，不记录日志
      } finally {
        // 清理单页图片文件
        if (imagePath) {
          try {
            await fs.remove(imagePath);
          } catch (e) {
            // 忽略清理错误
          }
        }
      }
    }
  } finally {
    // 清理临时目录
    try {
      await fs.remove(tempDir);
    } catch (error) {
      // 忽略清理错误
    }
  }

  const finalText = textParts.join('\n').trim();

  return finalText;
}

module.exports = {
  runOcrOnPdf,
  checkPopplerAvailable,
  getPdfPageCount
};
