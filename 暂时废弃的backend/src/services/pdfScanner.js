const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { fromPath } = require("pdf2pic");
const { createCanvas, loadImage, createImageData } = require("canvas");
const ort = require("onnxruntime-node");
const { init, setOCREnv } = require("esearch-ocr");

// 配置区域
const PDF_DATABASE_DIR = path.resolve(__dirname, '../../../PDFdatabase');
const OUTPUT_DIR = './preprocessTXT';

const MODEL_CONFIG = {
    detPath: path.resolve(__dirname, "./pdfOCR/ppocr_det.onnx"),
    recPath: path.resolve(__dirname, "./pdfOCR/ppocr_rec.onnx"),
    dicPath: path.resolve(__dirname, "./pdfOCR/ppocr_keys_v1.txt")
};

// 全局 OCR 实例
let localOCR = null;

/**
 * 初始化 OCR 引擎 (单例模式)
 */
async function getOCREngine() {
    if (!localOCR) {
        console.log('🚀 初始化 eSearchOCR (ONNX) 引擎...');

        // 1. 检查模型文件是否存在
        if (!fsSync.existsSync(MODEL_CONFIG.detPath) ||
            !fsSync.existsSync(MODEL_CONFIG.recPath) ||
            !fsSync.existsSync(MODEL_CONFIG.dicPath)) {
            throw new Error(`❌ 模型文件丢失，请检查路径:\n${JSON.stringify(MODEL_CONFIG, null, 2)}`);
        }

        // 2. 设置 OCR 环境 (绑定 Canvas)
        setOCREnv({
            canvas: (w, h) => createCanvas(w, h),
            imageData: createImageData,
        });

        // 3. 加载模型
        localOCR = await init({
            det: {
                input: fsSync.readFileSync(MODEL_CONFIG.detPath).buffer,
            },
            rec: {
                input: MODEL_CONFIG.recPath, // rec 支持直接传路径
                decodeDic: fsSync.readFileSync(MODEL_CONFIG.dicPath).toString(),
            },
            ort,
        });
        console.log('✅ OCR 引擎加载完成');
    }
    return localOCR;
}


/**
 * 利用坐标重建页面布局（优化表格识别）
 * @param {Array} paragraphs OCR返回的段落数组
 * @returns {string} 重建后的文本
 */
function reconstructPageContent(paragraphs) {
    if (!paragraphs || paragraphs.length === 0) return "";

    // 1. 计算每个块的几何中心，方便处理
    const blocks = paragraphs.map(p => {
        // box 通常是 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (左上, 右上, 右下, 左下)
        // 我们取左上角(y1)和左下角(y4)的平均值作为垂直中心
        const y1 = p.box[0][1];
        const y4 = p.box[3][1];
        const x1 = p.box[0][0];

        return {
            text: p.text,
            yCenter: (y1 + y4) / 2,
            x: x1,
            height: Math.abs(y4 - y1)
        };
    });

    // 2. 按 Y 轴中心排序
    blocks.sort((a, b) => a.yCenter - b.yCenter);

    const rows = [];
    let currentRow = [];

    // 阈值：如果两个块的 Y 中心差距小于平均行高的一半，视为同一行
    // 这里取第一个块的高度作为初始参考，动态调整会更复杂，这里用简单阈值通常足够
    let currentRowY = blocks[0]?.yCenter;
    let threshold = 10;

    for (const block of blocks) {
        if (Math.abs(block.yCenter - currentRowY) <= threshold) {
            // 属于当前行
            currentRow.push(block);
        } else {
            // 新的一行
            // 保存上一行（先按 X 轴排序）
            rows.push(currentRow.sort((a, b) => a.x - b.x));

            // 开启新行
            currentRow = [block];
            currentRowY = block.yCenter;
            threshold = block.height / 2; // 更新阈值
        }
    }
    // 加入最后一行
    if (currentRow.length > 0) {
        rows.push(currentRow.sort((a, b) => a.x - b.x));
    }

    // 3. 拼接文本
    // 表格优化：同一行的块之间加 Tab (\t) 或 多个空格，普通文本则加空格
    return rows.map(row => {
        return row.map(item => item.text).join('\t'); // 使用 Tab 分隔，Excel 可直接粘贴
    }).join('\n');
}

/**
 * 辅助函数：将图片 Buffer 解码为 OCR 需要的 ImageData
 * @param {Buffer} buffer 图片文件的原始 Buffer
 */
async function bufferToImageData(buffer) {
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
}

/**
 * 处理单个 PDF 文件
 * @param {string} pdfPath 
 */
async function ocrPdfFile(pdfPath) {
    const ocr = await getOCREngine();

    const convert = fromPath(pdfPath, {
        density: 300, // 如果表格线很细，可以尝试提高DPI
        format: "png",
        preserveAspectRatio: true
    });

    try {
        const outputs = await convert.bulk(-1, { responseType: "buffer" });
        const pageTexts = [];

        for (let i = 0; i < outputs.length; i++) {
            try {
                const imageData = await bufferToImageData(outputs[i].buffer);
                const ocrResult = await ocr.ocr(imageData);

                let pageContent = "";

                if (ocrResult && ocrResult.parragraphs) {
                    // 确保 paragraphs 里有 box 属性，ppocr 默认是有 box 的
                    pageContent = reconstructPageContent(ocrResult.parragraphs);
                }

                pageTexts.push(pageContent.trim());

            } catch (pageError) {
                console.error(`      第 ${i + 1} 页识别失败:`, pageError.message);
                pageTexts.push("");
            }
        }

        return pageTexts.join('\n\n--- 页分隔 ---\n\n');
    } catch (error) {
        throw new Error(`OCR处理失败: ${error.message}`);
    }
}

/**
 * 扫描PDF数据库目录，使用OCR提取所有PDF文本内容
 * @returns {Promise<Array<{filePath: string, category: string, content: string, mtime: number}>>}
 */
async function scanKnowledgeBase() {
    try {
        await fs.access(PDF_DATABASE_DIR);
    } catch {
        throw new Error(`PDF数据库目录不存在: ${PDF_DATABASE_DIR}`);
    }

    const results = [];
    let processedCount = 0;
    let errorCount = 0;

    // 确保输出目录存在
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 递归扫描函数
    async function scanDir(dirPath, categoryHierarchy) {
        const files = await fs.readdir(dirPath);
        const subdirs = [];
        const pdfFiles = [];

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                subdirs.push({ name: file, path: fullPath });
            } else if (file.toLowerCase().endsWith('.pdf')) {
                pdfFiles.push({ name: file, path: fullPath, stat });
            }
        }

        if (subdirs.length > 0) {
            if (pdfFiles.length > 0) {
                console.warn(`⚠️  警告: ${dirPath} 包含混合内容，将优先处理子目录`);
            }
            for (const subdir of subdirs) {
                await scanDir(subdir.path, [...categoryHierarchy, subdir.name]);
            }
        } else if (pdfFiles.length > 0) {
            console.log(`  └─ ${categoryHierarchy.join('/')}: ${pdfFiles.length} 个PDF文件`);

            for (const pdf of pdfFiles) {
                try {
                    console.log(`\n📝 正在处理 (${++processedCount}): ${pdf.name}`);

                    const content = await ocrPdfFile(pdf.path);

                    const filename = `${pdf.name.slice(0, -4)}.txt`;
                    const filepath = path.join(OUTPUT_DIR, filename);
                    await fs.writeFile(filepath, content, 'utf8');

                    results.push({
                        filePath: pdf.path,
                        category: categoryHierarchy.join('-'),
                        content,
                        mtime: pdf.stat.mtimeMs
                    });

                    console.log(`    ✅ 完成: ${pdf.name}`);
                } catch (error) {
                    errorCount++;
                    console.error(`    ❌ 处理失败 ${pdf.name}:`, error.message);
                }
            }
        }
    }

    const categories = await fs.readdir(PDF_DATABASE_DIR);
    console.log(`📂 发现分类: ${categories.join(', ')}`);
    console.log('='.repeat(60));

    for (const category of categories) {
        const categoryPath = path.join(PDF_DATABASE_DIR, category);
        const stat = await fs.stat(categoryPath);

        if (!stat.isDirectory()) {
            console.warn(`⚠️  跳过非目录项: ${category}`);
            continue;
        }

        await scanDir(categoryPath, [category]);
    }

    // 清理逻辑：ONNX Runtime Node 通常不需要显式 terminate，但在进程结束时会自动释放
    // 如果 eSearchOCR 提供了 destroy 方法，可以在这里调用
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 扫描完成！成功: ${results.length - errorCount} 个，失败: ${errorCount} 个`);

    return results;
}

// 优雅的退出处理
process.on('SIGINT', () => {
    console.log('\n🔄 检测到中断信号，退出程序...');
    // 如果有需要手动释放的资源（如数据库连接），在此处处理
    process.exit(0);
});

module.exports = { scanKnowledgeBase, PDF_DATABASE_DIR };