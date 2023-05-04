import mqtt, { MqttClient } from 'mqtt';

import { MQTT_URI } from '@/config';

import logger from '@/utils/logger';

class MQTT {
  private static instance: MQTT;
  public client: MqttClient;
  
  constructor() {
    try {
      this.client = mqtt.connect(MQTT_URI);
    } catch (error) {
      logger.error(error);
    }
  }

  public static getInstance(): MQTT {
    if (!MQTT.instance) {
      MQTT.instance = new MQTT();
    }
    return MQTT.instance;
  }
}

const mqttClient = MQTT.getInstance();

export default mqttClient;
