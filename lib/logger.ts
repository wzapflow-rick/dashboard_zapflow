const isDevelopment = process.env.NODE_ENV !== 'production';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'security';
    message: string;
    context?: Record<string, unknown>;
    userId?: string | number;
    ip?: string;
}

function formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
}

function writeToLog(level: LogEntry['level'], message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context: isDevelopment ? context : sanitizeForProduction(context),
    };
    
    const formatted = formatLogEntry(entry);
    
    switch (level) {
        case 'error':
        case 'security':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        default:
            if (isDevelopment) console.log(formatted);
    }
    
    return entry;
}

function sanitizeForProduction(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;
    
    const sensitiveFields = ['password', 'senha', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(f => lowerKey.includes(f))) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

export const logger = {
    log: (message: string, ...args: unknown[]) => {
        if (isDevelopment) console.log(message, ...args);
    },
    error: (message: string, context?: Record<string, unknown>) => {
        writeToLog('error', message, context);
    },
    warn: (message: string, context?: Record<string, unknown>) => {
        writeToLog('warn', message, context);
    },
    info: (message: string, context?: Record<string, unknown>) => {
        writeToLog('info', message, context);
    },
    security: (message: string, context?: Record<string, unknown>) => {
        writeToLog('security', message, context);
    },
    
    securityLoginFailure: (email: string, reason: string, ip?: string) => {
        writeToLog('security', 'LOGIN_FAILURE', { 
            email: maskEmail(email), 
            reason, 
            ip,
            attemptTime: new Date().toISOString() 
        });
    },
    
    securityLoginSuccess: (email: string, userId: string | number, ip?: string) => {
        writeToLog('security', 'LOGIN_SUCCESS', { 
            email: maskEmail(email), 
            userId, 
            ip,
            timestamp: new Date().toISOString() 
        });
    },
    
    securityAccessDenied: (userId: string | number, resource: string, action: string, ip?: string) => {
        writeToLog('security', 'ACCESS_DENIED', { 
            userId, 
            resource, 
            action, 
            ip,
            timestamp: new Date().toISOString() 
        });
    },
    
    securityAdminAction: (userId: string | number, action: string, target: string, details?: Record<string, unknown>) => {
        writeToLog('security', 'ADMIN_ACTION', { 
            userId, 
            action, 
            target,
            ...details,
            timestamp: new Date().toISOString() 
        });
    },
};

function maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    
    const local = parts[0];
    const domain = parts[1];
    
    if (local.length <= 2) {
        return `**@${domain}`;
    }
    
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export default logger;