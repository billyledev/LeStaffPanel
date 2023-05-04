import Logger from 'simple-node-logger';
import { LOG_OPTS, LOG_LEVEL } from '@/config';

const logger = Logger.createRollingFileLogger(LOG_OPTS);
logger.setLevel(LOG_LEVEL);
const consoleAppender = new Logger.appenders.ConsoleAppender({});
consoleAppender.setLevel(LOG_LEVEL);
logger.addAppender(consoleAppender);

export default logger;
