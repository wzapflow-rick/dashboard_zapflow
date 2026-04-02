// Logger centralizado para debug
// Em produção, usar ambiente para controlar logs

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
    log: (message: string, ...args: any[]) => {
        if (isDevelopment) console.log(message, ...args);
    },
    error: (message: string, ...args: any[]) => {
        if (isDevelopment) console.error(message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        if (isDevelopment) console.warn(message, ...args);
    },
    info: (message: string, ...args: any[]) => {
        if (isDevelopment) console.info(message, ...args);
    }
};

export default logger;