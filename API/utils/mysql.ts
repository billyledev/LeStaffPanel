import mysql, { Connection } from 'mysql';

import { MYSQL_HOST, MYSQL_USER, MYSQL_DB } from '@/config';
import { MYSQL_PASS } from '@/secrets';

import logger from '@/utils/logger';

class MySQL {
  private static instance: MySQL;
  public client: Connection;

  constructor() {
    try {
      this.client = mysql.createConnection({
        host: MYSQL_HOST,
        user: MYSQL_USER,
        password: MYSQL_PASS,
        database: MYSQL_DB,
      });
      this.client.connect();
    } catch (error) {
      logger.error(error);
    }
  }

  public stop() {
    try {
      this.client.end();
    } catch (error) {
      logger.error(error);
    }
  }

  public static getInstance(): MySQL {
    if (!MySQL.instance) {
      MySQL.instance = new MySQL();
    }
    return MySQL.instance;
  }
}

const mysqlClient = MySQL.getInstance();

export default mysqlClient;
