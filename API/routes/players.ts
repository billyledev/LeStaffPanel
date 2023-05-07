import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  CC_SKINS_BASE,
  TEMP_DIR,
  COSMETICS_DIR,
  SKINS_DIR,
} from '@/config';
import { JWT_SECRET } from '@/secrets';

import logger from '@/utils/logger';
import { CODE_REGEX } from '@/utils/regex';
import mysql from '@/utils/mysql';

import { getPlayerInfos, getCode, deleteCode } from '@/models/player';

const router = Router();

router.get('/infos', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      status: 'error',
      message: 'Missing token.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Invalid token.',
      });
      return;
    }
    const { username } = decoded;

    const infos = await getPlayerInfos(username);
    logger.info(`${infos.username} requested account informations.`);
    res.status(StatusCodes.OK).json({
      status: 'success',
      infos,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'The provided token has expired.',
      });
      return;
    }

    logger.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Unknown exception.',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !CODE_REGEX.test(code)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a valid code.',
      });
      return;
    }

    const username = await getCode(code);
    if (username == null) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'The provided code is incorrect.',
      });
      return;
    }

    await deleteCode(username);

    const jwt_token = jwt.sign({
      username,
    }, JWT_SECRET, {
      expiresIn: '7d',
    });
    logger.info(`${username} logged in.`);
    res.status(StatusCodes.OK).json({
      username,
      token: jwt_token,
    });
  } catch (error) {
    logger.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Unknown exception.',
    });
  }
});

router.get('/wear/:item', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      status: 'error',
      message: 'Missing token.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Invalid token.',
      });
      return;
    }
    const { username } = decoded;
    const infos = await getPlayerInfos(username);

    const { item } = req.params;
    if (infos.cosmeticsOwned.indexOf(item) === -1) {
      res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'You need to buy this item first.',
      });
      return;
    }

    const skin_response = await fetch(`${CC_SKINS_BASE}/${infos.username}.png`);
    const tempSkinPath = path.resolve(__dirname, TEMP_DIR, `${infos.username}.png`);
    const dirSkinPath = path.resolve(__dirname, SKINS_DIR, `${infos.username}.png`);
    const cosmeticPath = path.resolve(__dirname, COSMETICS_DIR, `${item}.png`);
    const fileStream = fs.createWriteStream(tempSkinPath);
    await new Promise((resolve, reject) => {
      skin_response.body.pipe(fileStream);
      skin_response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    sharp(tempSkinPath)
      .extract({
        left: 0,
        top: 0,
        width: 64,
        height: 32,
      })
      .extend({
        bottom: 32,
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        },
      })
      .composite([
        {
          input: cosmeticPath,
          top: 32,
          left: 0,
        },
      ])
      .toFile(dirSkinPath);
    
    mysql.client.query('UPDATE Players SET Wearing = ? WHERE Name = ?', [
      'cape',
      username,
    ], (error, results, fields) => {
      if (error) {
        throw error;
      }
    });

    mysql.client.query('UPDATE Players SET CosmeticsUpdated = ? WHERE Name = ?', [
      false,
      username,
    ], (error, results, fields) => {
      if (error) {
        throw error;
      }
    });
    
    logger.info(`${infos.username} is now wearing a ${item}.`);
    res.status(StatusCodes.OK).json({
      status: 'success',
    });
  } catch (error) {
    logger.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Unknown exception.',
    });
  }
});

export default router;
