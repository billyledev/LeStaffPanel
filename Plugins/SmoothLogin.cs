//reference System.dll
//reference System.Data.dll
using System;
using System.Data;
using System.Collections.Generic;

using MCGalaxy;
using MCGalaxy.DB;
using MCGalaxy.SQL;
using MCGalaxy.Commands;
using MCGalaxy.Tasks;

namespace PluginSmoothLogin {
  public class SmoothLoginPlugin: Plugin {
    public override string creator { get { return "billyledev"; } }
    public override string MCGalaxy_Version { get { return "1.9.4.8"; } }
    public override string name { get { return "SmoothLoginPlugin"; } }

    public const string PLAYERS_TABLE = "Players";

    public const string NAME_FIELD = "Name";
    public const string CODE_FIELD = "LoginCode";
    public const string CODE_EXP_FIELD = "CodeExpiration";

    // Check for expired codes every 60 seconds.
    private const int CHECK_DELAY = 60;
    // Number of minutes before automatically deleting a code.
    public const int CODE_VALIDITY = 5;

    // The codes list
    public static Dictionary<string, long> loginCodes = new Dictionary<string, long>();
    private SchedulerTask checkCodesTask;

    public override void Load(bool startup) {
      Command.Register(new CmdLoginCode());

      // Add the required columns if missing.
      List<string> columns = Database.Backend.ColumnNames(PLAYERS_TABLE);
      if (columns.Count != 0) {
        if (!columns.CaselessContains(CODE_FIELD)) {
          Database.AddColumn(PLAYERS_TABLE, new ColumnDesc(CODE_FIELD, ColumnType.Char, 6), NAME_FIELD);
        }

        if (!columns.CaselessContains(CODE_EXP_FIELD)) {
          Database.AddColumn(PLAYERS_TABLE, new ColumnDesc(CODE_EXP_FIELD, ColumnType.Int64), CODE_FIELD);
        }
      }

      // Load the login codes and corresponding expirations.
      Database.ReadRows(PLAYERS_TABLE, "*", record => LoadCodeInfos(record));

      // Regularly checks for expired login codes.
      checkCodesTask = Server.MainScheduler.QueueRepeat(CodeExpirationCheckTask, null, TimeSpan.FromSeconds(CHECK_DELAY));
    }

    public override void Unload(bool startup) {
      Command.Unregister(Command.Find("LoginCode"));
      Server.MainScheduler.Cancel(checkCodesTask);
    }

    private void CodeExpirationCheckTask(SchedulerTask task) {
      Dictionary<string, long> loginCodesCopy = new Dictionary<string, long>(loginCodes);

      foreach (string code in loginCodesCopy.Keys) {
        long expiry = loginCodes[code];
        if (DateTime.UtcNow < expiry.FromUnixTime()) continue;

        Database.UpdateRows(PLAYERS_TABLE, CODE_FIELD + "=@0", "WHERE " + CODE_FIELD + "=@1", null, code);
        loginCodes.Remove(code);
      }
    }

    private void LoadCodeInfos(ISqlRecord record) {
      string code = record.GetText(CODE_FIELD);

      long codeExpiration;
      try {
        codeExpiration = record.GetLong(CODE_EXP_FIELD);
      } catch (InvalidCastException e) {
        codeExpiration = 0;
        Logger.LogError("Error reading expiration", e);
      }

      if (!code.Equals(null)) {
        loginCodes.Add(code, codeExpiration);
      }
    }
  }

  public sealed class CmdLoginCode: Command2 {
    public override string name { get { return "LoginCode"; } }
    public override string shortcut { get { return "lc"; } }
    public override string type { get { return CommandTypes.Other; } }
    private Random rand = new Random();
    private const string ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890";

    private string RandomString(int size) {
      string randomString = "";

      for (int i = 0; i < size; i++) {
        randomString += ALPHABET[rand.Next(ALPHABET.Length)];
      }

      return randomString;
    }

    public override void Use(Player p, string message, CommandData data) {
      // The Console is not meant to use this command.
      if (p.IsSuper) return;

      string code = RandomString(6);
      int span = SmoothLoginPlugin.CODE_VALIDITY;
      long removeDate = (DateTime.UtcNow.AddMinutes(span)).ToUnixTime();

      // Add the login code and corresponding expiration in the codes list and in the DB.
      SmoothLoginPlugin.loginCodes.Add(code, removeDate);
      Database.UpdateRows(SmoothLoginPlugin.PLAYERS_TABLE, SmoothLoginPlugin.CODE_FIELD + "=@0",
        "WHERE " + SmoothLoginPlugin.NAME_FIELD + "=@1", code, p.name);
      Database.UpdateRows(SmoothLoginPlugin.PLAYERS_TABLE, SmoothLoginPlugin.CODE_EXP_FIELD + "=@0",
        "WHERE " + SmoothLoginPlugin.NAME_FIELD + "=@1", removeDate, p.name);

      p.Message("&SUse this code to sign in the online shop : " + code);
      p.Message("%cPLEASE DO NOT SHARE THIS CODE WITH ANYONE!");
      p.Message("&SKeep in mind that this code will be only valid for " + span + " minutes.");
    }

    public override void Help(Player p) {
      p.Message("%T/LoginCode");
      p.Message("%HGives you a code to login on the online store (only valid for "
        + SmoothLoginPlugin.CODE_VALIDITY + " minutes).");
      p.Message("%cPLEASE NEVER SHARE THIS CODE WITH ANYONE!");
    }
  }
}
