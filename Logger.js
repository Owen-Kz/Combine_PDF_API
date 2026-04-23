const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logDir = __dirname, logFileName = 'process_logs.txt') {
        this.logFilePath = path.join(logDir, logFileName);
        this.ensureLogFileExists();
    }
    
    ensureLogFileExists() {
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, '');
        }
    }
    
    log(content, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${content}\n`;
        
        fs.appendFile(this.logFilePath, logEntry, (err) => {
            if (err) {
                console.error('Error writing to log file:', err);
            }
        });
    }
    
    info(content) {
        this.log(content, 'INFO');
    }
    
    error(content) {
        this.log(content, 'ERROR');
    }
    
    warn(content) {
        this.log(content, 'WARN');
    }
    
    debug(content) {
        this.log(content, 'DEBUG');
    }
    
    // Sync version for critical logs
    logSync(content, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${content}\n`;
        
        try {
            fs.appendFileSync(this.logFilePath, logEntry);
        } catch (err) {
            console.error('Error writing to log file:', err);
        }
    }
}

// Create and export a singleton instance
const logger = new Logger();

// Export the main function for backward compatibility
function LogAction(content, level = 'INFO') {
    logger.log(content, level);
}

module.exports = { LogAction, logger };