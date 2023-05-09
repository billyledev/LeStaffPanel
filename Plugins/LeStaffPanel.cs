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
using MCGalaxy.SQL;
using MCGalaxy.Events;
using MCGalaxy.Events.PlayerEvents;

namespace PluginLeStaffPanel {
  class MqttMessage {
    public string Type;
    public string Username;
    public string Target;
    public string Reason;
  }

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
    private static readonly MqttTopicFilterBuilder mqttTopicFilterBuilder = new MqttTopicFilterBuilder();
    private static List<MqttTopicFilter> topics = new List<MqttTopicFilter> {
      mqttTopicFilterBuilder.WithTopic(PANEL_ACTIONS_TOPIC).Build(),
    };
    private static readonly IManagedMqttClient mqttClient = mqttFactory.CreateManagedMqttClient();

    private Command muteCommand = Command.Find("Mute");
    private Command kickCommand = Command.Find("Kick");

    public const string PLAYERS_TABLE = "Players";
    public const string NAME_FIELD = "Name";
    public const string RANK_FIELD = "Rank";

    public override void Load(bool startup) {
      // Add the required column if missing
      List<string> columns = Database.Backend.ColumnNames(PLAYERS_TABLE);
      if (columns.Count != 0) {
        if (!columns.CaselessContains(RANK_FIELD)) {
          Database.AddColumn(PLAYERS_TABLE, new ColumnDesc(RANK_FIELD, ColumnType.Int8), NAME_FIELD);
        }
      }

      mqttClient.StartAsync(mqttClientOptions);
      mqttClient.SubscribeAsync(topics);
      mqttClient.ApplicationMessageReceivedAsync += e => {
        try {
          string topic = e.ApplicationMessage.Topic;

          if (!string.IsNullOrWhiteSpace(topic)) {
            string payload = Encoding.UTF8.GetString(e.ApplicationMessage.Payload);
            MqttMessage content = JsonConvert.DeserializeObject<MqttMessage>(payload);
            processMessage(content);
          }
        } catch (Exception ex) {
          Logger.LogError("Error reading expiration", ex);
        }

        return Task.CompletedTask;
      };

      OnPlayerConnectEvent.Register(PlayerConnectCallback, Priority.Critical);
      OnPlayerDisconnectEvent.Register(PlayerDisconnectCallback, Priority.Critical);
      OnModActionEvent.Register(HandleModerationAction, Priority.Critical);
    }

    public override void Unload(bool startup) {
      mqttClient.StopAsync().GetAwaiter().GetResult();

      OnPlayerConnectEvent.Unregister(PlayerConnectCallback);
      OnPlayerDisconnectEvent.Unregister(PlayerDisconnectCallback);
      OnModActionEvent.Unregister(HandleModerationAction);
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
      mqttClient.EnqueueAsync(SERVER_EVENTS_TOPIC, payload);
    }

    private void SetRankInDB(string name, int rank) {
      Database.UpdateRows(PLAYERS_TABLE, RANK_FIELD + "=@0", "WHERE " + NAME_FIELD + "=@1", rank, name);
    }

    private void HandleModerationAction(ModAction action) {
      switch (action.Type) {
        case ModActionType.Rank: {
          string username = PlayerInfo.FindExact(action.Target).name;
          int rank = (int)((Group)action.Metadata).Permission;

          string payload = JsonConvert.SerializeObject(new {
            type = "player_rank",
            username = username,
            rank = rank,
          });
          mqttClient.EnqueueAsync(SERVER_EVENTS_TOPIC, payload);

          SetRankInDB(username, rank);

          break;
        }
      }
    }

    private bool validName(string username) {
      return Formatter.ValidPlayerName(Player.Console, username);
    }

    private Player buildShadowPlayer(string username) {
      Player p = new Player(username);
      p.group = Group.GroupIn(p.name);
      return p;
    }

    private void processMessage(MqttMessage content) {
      if (content.Username == null ||
          string.IsNullOrWhiteSpace(content.Username) ||
          !validName(content.Username)) {
        return;
      }

      Player p = PlayerInfo.FindMatches(Player.Console, content.Username);
      bool online = true;

      if (p == null || !p.name.Equals(content.Username)) {
        p = buildShadowPlayer(content.Username);
        online = false;
      }

      switch (content.Type) {
        case "mute": {
          if (content.Target == null ||
              string.IsNullOrWhiteSpace(content.Target) ||
              !validName(content.Target)) {
            break;
          }

          string args = content.Target;

          muteCommand.Use(p, args);
          break;
        }

        case "kick": {
          if (content.Target == null ||
              string.IsNullOrWhiteSpace(content.Target) ||
              !validName(content.Target)) {
            break;
          }

          string args = content.Target;
          if (content.Reason != null && !string.IsNullOrWhiteSpace(content.Reason)) {
            args += " " + content.Reason;
          }

          kickCommand.Use(p, args);
          break;
        }
      }

      if (!online) p.Dispose();
    }
  }
}