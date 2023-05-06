//reference System.dll
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

//reference Newtonsoft.Json.dll
using Newtonsoft.Json;

//reference MQTTnet.dll
//reference MQTTnet.Extensions.ManagedClient.dll
using MQTTnet;
using MQTTnet.Packets;
using MQTTnet.Client;
using MQTTnet.Extensions.ManagedClient;

using MCGalaxy;

namespace PluginLeStaffPanel {
  public class LeStaffPanelPlugin: Plugin {
    public override string creator { get { return "billyledev"; } }
    public override string MCGalaxy_Version { get { return "1.9.4.8"; } }
    public override string name { get { return "LeStaffPanelPlugin"; } }

    private const string SERVER_EVENTS_TOPIC = "server/events";
    private const string PANEL_ACTIONS_TOPIC = "panel/actions";

    private static readonly MqttFactory mqttFactory = new MqttFactory();
    private static readonly MqttClientOptionsBuilder mqttClientOptionsBuilder = new MqttClientOptionsBuilder()
      .WithTcpServer("localhost");
    private static readonly ManagedMqttClientOptions mqttClientOptions = new ManagedMqttClientOptionsBuilder()
      .WithAutoReconnectDelay(TimeSpan.FromSeconds(60))
      .WithClientOptions(mqttClientOptionsBuilder.Build())
      .Build();
    private static readonly MqttClientDisconnectOptions mqttClientDisconnectOptions = new MqttClientDisconnectOptionsBuilder()
      .WithReason(MqttClientDisconnectOptionsReason.NormalDisconnection)
      .Build();
    private static readonly MattTopicFilterBuilder mqttTopicFilterBuilder = new MqttTopicFilterBuilder();
    private static List<MqttTopicFilter> topics = new List<MqttTopicFilter> {
      mqttTopicFilterBuilder.WithTopic(PANEL_ACTIONS_TOPIC).Build(),
    };
    private static readonly IManagedMqttClient mqttClient = mqttFactory.CreateManagedMqttClient();

    public override void Load(bool startup) {
      mqttClient.StartAsync(mqttClientOptions);
      mqttClient.SubscribeAsync(topics);
      mqttClient.ApplicationMessageReceivedAsync += e => {
        try {
          string topic = e.ApplicationMessage.Topic;

          if (string.IsNullOrWhiteSpace(topic) == false) {
            string payload = Encoding.UTF8.GetString(e.ApplicationMessage.Payload);
            Logger.Log(LogType.SystemActivity, "Topic: " + topic + ". Message Received: " + payload);
          }
        } catch (Exception ex) {
          Logger.LogError("Error reading expiration", ex);
        }

        return Task.CompletedTask;
      };

      OnPlayerConnectEvent.Register(PlayerConnectCallback, Priority.Critical);
      OnPlayerDisconnectEvent.Register(PlayerDisconnectCallback, Priority.Critical);
    }

    public override void Unload(bool startup) {
      mqttClient.StopAsync().GetAwaiter().GetResult();

      OnPlayerConnectEvent.Unregister(PlayerConnectCallback);
      OnPlayerDisconnectEvent.Unregister(PlayerDisconnectCallback);
    }

    private void PlayerConnectCallback(Player p) {
      string payload = JsonConvert.SerializeObject(new {
        type = "player_connected",
        username = p.name,
      });
      mqttClient.EnqueueAsync(SERVER_EVENTS_TOPIC, payload);
    }

    private void PlayerDisconnectCallback(Player p, string reason) {
      string payload = JsonConvert.SerializeObject(new {
        type = "player_disconnected",
        username = p.name,
        reason = reason,
      });
    }
  }
}