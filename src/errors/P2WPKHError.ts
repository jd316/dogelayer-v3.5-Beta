export class P2WPKHError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'P2WPKHError';
    }
} 