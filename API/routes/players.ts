import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { JWT_SECRET } from '@/secrets';

import logger from '@/utils/logger';
import { CODE_REGEX } from '@/utils/regex';

import { getPlayerData, validJWTData, getUsernameFromCode, deleteCodeFromDB } from '@/models/player';

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
    if (!decoded || !(await validJWTData(decoded))) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Invalid token.',
      });
      return;
    }
    const { username } = decoded;

    const infos = await getPlayerData(username);
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

    const username = await getUsernameFromCode(code);
    if (username == null) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'The provided code is incorrect.',
      });
      return;
    }

    await deleteCodeFromDB(username);
    const data = await getPlayerData(username);

    const jwt_token = jwt.sign({
      username,
      rank: data.rank,
    }, JWT_SECRET, {
      expiresIn: '7d',
    });
    logger.info(`${username} logged in.`);
    res.status(StatusCodes.OK).json({
      username,
      rank: data.rank,
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

export default router;
