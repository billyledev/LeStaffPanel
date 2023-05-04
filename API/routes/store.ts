import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { Router } from 'express';

import { JWT_SECRET } from '@/secrets';

import logger from '@/utils/logger';
import mysql from '@/utils/mysql';

import { getPlayerInfos } from '@/models/player';
import { getStoreData, getItemData } from '@/models/store';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = getStoreData();
  
    res.status(StatusCodes.OK).json({
      status: 'success',
      data,
    });
  } catch (error) {
    logger.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Unknown exception.',
    });
  }
});

router.get('/buy/:item', async (req, res) => {
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

    const storeData = getStoreData();
    const { item } = req.params;
    const itemData = getItemData(item, storeData);
    if (!itemData) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'This item isn\'t available in the store.',
      });
      return;
    }

    if (infos.money < itemData.cost) {
      res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'Not enough money to buy this item.',
      });
      return;
    }

    switch (itemData.type) {
      // case 'nick': {
      //   const { nick } = req.body;
      //   if (!nick || !validNick(nick)) {
      //     res.status(CODE_BAD_REQUEST).json({
      //       status: 'error',
      //       message: 'Invalid nick.',
      //     });
      //     return;
      //   }

      //   await setItem(username, item, nick);
      //   res.status(CODE_OK).json({
      //     status: 'success',
      //   });
      //   break;
      // }
      // case 'resettitle': {
      //   await setItem(username, item, '');
      //   res.status(CODE_OK).json({
      //     status: 'success',
      //   });
      //   break;
      // }
      case 'cosmetic|cape': {
        if (infos.cosmeticsOwned.indexOf(item) !== -1) {
          res.status(StatusCodes.FORBIDDEN).json({
            status: 'error',
            message: 'You have already bought this cosmetic.',
          });
          return;
        }

        mysql.client.beginTransaction((err) => {
          if (err) throw err;

          mysql.client.query('UPDATE Players SET Money = ? WHERE Name = ?', [
            infos.money - itemData.cost,
            username,
          ], (error, results, fields) => {
            if (error) {
              return mysql.client.rollback(() => {
                throw error;
              });
            }

            mysql.client.query('UPDATE Players SET CosmeticsOwned = ? WHERE Name = ?', [
              `${infos.cosmeticsOwned}${infos.cosmeticsOwned ? '|' : ''}${item}`,
              username,
            ], (error, results, fields) => {
              if (error) {
                return mysql.client.rollback(() => {
                  throw error;
                });
              }

              mysql.client.commit((err) => {
                if (err) {
                  return mysql.client.rollback(() => {
                    throw err;
                  });
                }
                logger.info(`${infos.username} bought a ${item}.`);
                res.status(StatusCodes.OK).json({
                  status: 'success',
                });
              });
            });
          });
        });
        break;
      }
    }
  } catch (error) {
    logger.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Unknown exception.',
    });
  }
});

export default router;
