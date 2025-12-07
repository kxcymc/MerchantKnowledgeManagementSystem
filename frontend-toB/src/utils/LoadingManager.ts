type LoadingState = 'loading' | 'success' | 'fail' | 'idle';

type Listener = (state: LoadingState, message?: string) => void;

class LoadingManager {
    private listeners: Listener[] = [];
    private state: LoadingState = 'idle';
    private message: string = '';
    private timer: NodeJS.Timeout | null = null;

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.state, this.message));
    }

    show(msg: string = 'Loading...') {
        if (this.timer) clearTimeout(this.timer);
        this.state = 'loading';
        this.message = msg;
        this.notify();
    }

    success(msg: string = 'Success') {
        if (this.timer) clearTimeout(this.timer);
        this.state = 'success';
        this.message = msg;
        this.notify();
        this.autoClose();
    }

    fail(msg: string = 'Failed') {
        if (this.timer) clearTimeout(this.timer);
        this.state = 'fail';
        this.message = msg;
        this.notify();
        this.autoClose();
    }

    private autoClose() {
        this.timer = setTimeout(() => {
            this.state = 'idle';
            this.message = '';
            this.notify();
        }, 1500); // Auto close after 1.5s
    }
}

export default new LoadingManager();
