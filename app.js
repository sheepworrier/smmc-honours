(function () {
  "use strict";
  var D = window.HONOURS;
  var app = document.getElementById("app");

  // ---------- indexes ----------
  var comps = {}, players = {}, teams = {}, raws = {}, boards = {};
  D.competitions.forEach(function (c) { c.names = []; comps[c.id] = c; });
  D.competitionNames.forEach(function (n) { comps[n.competition_id].names.push(n); });
  D.competitions.forEach(function (c) { c.names.sort(function (a, b) { return a.from_year - b.from_year; }); });
  D.players.forEach(function (p) { p.aliases = []; p.results = []; players[p.id] = p; });
  D.aliases.forEach(function (a) { players[a.player_id].aliases.push(a.alias); });
  D.teams.forEach(function (t) { t.results = []; teams[t.id] = t; });
  D.raw.forEach(function (r) { r.results = []; raws[r.id] = r; });
  D.boards.forEach(function (b) { boards[b.id] = b; });
  D.results.forEach(function (r) {
    r.c = comps[r.comp];
    r.players.forEach(function (pid) { players[pid].results.push(r); });
    if (r.team) teams[r.team].results.push(r);
    r.sources.forEach(function (s) { raws[s].results.push(r); });
  });

  var COUNTED = { championship: 1, handicap: 1, cup: 1, league: 1 };
  var OUTCOME = { winner: "Winner", runner_up: "Runner-up", semi_final: "Semi-finalist",
    highest_break: "Highest break", award: "Award", not_played: "Not played" };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function plink(pid) { return '<a href="#/player/' + pid + '">' + esc(players[pid].display_name) + "</a>"; }
  function tlink(tid) { return '<a href="#/teams">' + esc(teams[tid].name) + "</a>"; }
  function clink(c) { return '<a href="#/competition/' + c.id + '">' + esc(c.name) + "</a>"; }
  function cupName(c, year) {
    var n = null;
    c.names.forEach(function (x) { if (!year || x.from_year <= year) n = x.name; });
    return n && n !== c.name ? n : null;
  }
  function scopeTag(c) { return '<span class="tag ' + c.scope + '">' + (c.scope === "club" ? "Club" : "League") + "</span>"; }
  function sourceLinks(r) {
    var bs = [];
    r.sources.forEach(function (s) { var b = raws[s].board_id; if (bs.indexOf(b) < 0) bs.push(b); });
    return bs.map(function (b) { return '<a href="#/board/' + b + '">' + b + "</a>"; }).join(" ");
  }
  function isWin(r) { return r.outcome === "winner" && r.players.length > 0 && COUNTED[r.c.type]; }
  function decadeOf(y) { return Math.floor(y / 10) * 10; }
  function seg(name, options, current) {
    return '<div class="seg" role="group" aria-label="' + esc(name) + '">' + options.map(function (o) {
      return '<button data-seg="' + name + '" data-val="' + o[0] + '" aria-pressed="' + (o[0] === current) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  }
  function bindSegs(state, rerender) {
    app.querySelectorAll("[data-seg]").forEach(function (b) {
      b.addEventListener("click", function () { state[b.dataset.seg] = b.dataset.val; rerender(); });
    });
  }
  function withCompName(r) {
    var cup = cupName(r.c, r.year);
    return clink(r.c) + (cup ? ' <span class="muted small">(' + esc(cup) + ")</span>" : "") +
      (r.detail ? ' <span class="muted small">· ' + esc(r.detail) + "</span>" : "");
  }

  // Filter state shared by leaderboard + decades.
  var filt = { scope: "club", disc: "all" };
  function inFilter(r) {
    if (filt.scope === "club" && r.c.scope !== "club") return false;
    if (filt.disc !== "all" && r.c.discipline !== filt.disc) return false;
    return true;
  }
  function tally(results) {
    var t = {};
    results.forEach(function (r) {
      if (!isWin(r) || !inFilter(r)) return;
      r.players.forEach(function (pid) {
        var e = t[pid] || (t[pid] = { pid: pid, singles: 0, pairs: 0, total: 0, first: 9999, last: 0 });
        if (r.players.length === 1) e.singles++; else e.pairs++;
        e.total++;
        e.first = Math.min(e.first, r.year);
        e.last = Math.max(e.last, r.year);
      });
    });
    return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) {
      return b.total - a.total || a.first - b.first || players[a.pid].display_name.localeCompare(players[b.pid].display_name);
    });
  }
  function filterControls() {
    return '<div class="controls">' +
      seg("scope", [["club", "Club competitions"], ["all", "+ League honours"]], filt.scope) +
      seg("disc", [["all", "All"], ["snooker", "Snooker"], ["billiards", "Billiards"]], filt.disc) + "</div>";
  }

  // ---------- pages ----------
  function home() {
    var club = D.results.filter(function (r) { return r.c.scope === "club" && r.outcome === "winner"; });
    var years = D.results.map(function (r) { return r.year; }).filter(Boolean);
    var champs = {};
    club.forEach(function (r) { r.players.forEach(function (p) { champs[p] = 1; }); });
    var saved = filt.scope; filt.scope = "club";
    var top = tally(D.results).slice(0, 10);
    filt.scope = saved;
    var max = top.length ? top[0].total : 1;
    app.innerHTML =
      "<h1>Roll of Honour</h1>" +
      '<p class="lede">Every name from the club\'s honours boards, ' + Math.min.apply(null, years) + "–" + Math.max.apply(null, years) +
      ", gathered in one place. Search for a player, or explore the leaderboard and the club's history decade by decade.</p>" +
      '<input class="search" id="q" type="search" placeholder="Search for a player, e.g. Hughes" autocomplete="off">' +
      '<ul class="player-list" id="hits" style="margin-top:0.75rem"></ul>' +
      '<div class="stats" style="margin-top:1.25rem">' +
      stat(club.length, "club titles recorded") + stat(Object.keys(champs).length, "different club winners") +
      stat(D.competitions.filter(function (c) { return c.scope === "club" && c.type !== "award"; }).length, "club competitions") +
      stat(D.boards.length, "boards transcribed") + "</div>" +
      '<div class="panel"><h2 style="margin-top:0">Most club titles</h2>' + leaderTable(top, max) +
      '<p class="small"><a href="#/leaderboard">Full leaderboard →</a></p></div>';
    var q = document.getElementById("q"), hits = document.getElementById("hits");
    q.addEventListener("input", function () { hits.innerHTML = playerItems(q.value, 12); });
  }
  function stat(n, label) { return '<div class="stat"><b>' + n + "</b><span>" + esc(label) + "</span></div>"; }

  function leaderTable(rows, max) {
    if (!rows.length) return '<p class="empty">No wins match these filters.</p>';
    return '<div class="table-wrap"><table><thead><tr><th class="rank">#</th><th>Player</th>' +
      '<th class="num">Singles</th><th class="num">Pairs</th><th class="num">Total</th><th class="hide-sm" style="width:28%"></th><th class="hide-sm">Years</th></tr></thead><tbody>' +
      rows.map(function (e, i) {
        var prev = rows[i - 1];
        var rank = prev && prev.total === e.total ? "=" : i + 1;
        return "<tr><td class=\"rank\">" + rank + "</td><td>" + plink(e.pid) + (players[e.pid].honorary ? ' <span class="tag honorary">Hon.</span>' : "") +
          '</td><td class="num">' + e.singles + '</td><td class="num">' + e.pairs + '</td><td class="num"><b>' + e.total + "</b></td>" +
          '<td class="hide-sm"><div class="bar"><i style="width:' + (100 * e.singles / max) + '%"></i><i style="left:' + (100 * e.singles / max) +
          "%;width:" + (100 * e.pairs / max) + '%"></i></div></td><td class="hide-sm muted small">' + e.first + (e.last !== e.first ? "–" + e.last : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function leaderboard() {
    var rows = tally(D.results);
    app.innerHTML = "<h1>Leaderboard</h1>" +
      '<p class="lede">Competition wins per player. Pairs wins count one for each partner. Ties are ordered by who won first. ' +
      "Highest breaks, awards and team honours are not counted.</p>" + filterControls() +
      '<div class="panel">' + leaderTable(rows, rows.length ? rows[0].total : 1) + "</div>";
    bindSegs(filt, leaderboard);
  }

  function playerItems(q, limit) {
    q = (q || "").trim().toLowerCase();
    var list = D.players.filter(function (p) {
      if (!q) return true;
      return p.display_name.toLowerCase().indexOf(q) >= 0 || p.aliases.some(function (a) { return a.toLowerCase().indexOf(q) >= 0; });
    }).sort(function (a, b) {
      var sa = a.display_name.split(" ").pop(), sb = b.display_name.split(" ").pop();
      return sa.localeCompare(sb) || a.display_name.localeCompare(b.display_name);
    });
    if (q && !list.length) return '<li class="empty">No players match “' + esc(q) + "”</li>";
    if (!q && limit) return "";
    return list.slice(0, limit || list.length).map(function (p) {
      var wins = p.results.filter(isWin).length;
      return "<li>" + plink(p.id) + '<span class="muted small">' + (wins ? wins + (wins === 1 ? " win" : " wins") : p.results.length ? "honours" : "") + "</span></li>";
    }).join("");
  }

  function playersPage() {
    app.innerHTML = "<h1>Players</h1>" +
      '<p class="lede">' + D.players.length + " names appear on the boards. Where the boards spell a name differently, those spellings are listed on the player's page.</p>" +
      '<input class="search" id="q" type="search" placeholder="Filter players" autocomplete="off">' +
      '<ul class="player-list" id="hits" style="margin-top:1rem"></ul>';
    var q = document.getElementById("q"), hits = document.getElementById("hits");
    hits.innerHTML = playerItems("");
    q.addEventListener("input", function () { hits.innerHTML = playerItems(q.value); });
  }

  var pstate = { show: "all" };
  function playerPage(pid) {
    var p = players[pid];
    if (!p) return notFound();
    var rs = p.results.slice().sort(function (a, b) { return a.year - b.year || a.c.sort_order - b.c.sort_order; });
    var clubWins = rs.filter(function (r) { return isWin(r) && r.c.scope === "club"; });
    var leagueWins = rs.filter(function (r) { return isWin(r) && r.c.scope !== "club"; });
    var years = rs.map(function (r) { return r.year; });
    var shown = rs.filter(function (r) {
      return pstate.show === "all" || (pstate.show === "club" ? r.c.scope === "club" : r.c.scope !== "club");
    });
    var byDisc = {};
    clubWins.forEach(function (r) { byDisc[r.c.discipline] = (byDisc[r.c.discipline] || 0) + 1; });
    app.innerHTML = '<p class="small"><a href="#/players">← All players</a></p>' +
      "<h1>" + esc(p.display_name) + (p.honorary ? ' <span class="tag honorary">Honorary member</span>' : "") + "</h1>" +
      '<p class="lede">Appears on the boards as ' + p.aliases.map(function (a) { return "<b>" + esc(a) + "</b>"; }).join(", ") +
      (p.note ? '. <span class="muted">' + esc(p.note) + "</span>" : "") + "</p>" +
      '<div class="stats">' +
      stat(clubWins.filter(function (r) { return r.players.length === 1; }).length, "club singles titles") +
      stat(clubWins.filter(function (r) { return r.players.length > 1; }).length, "club pairs titles") +
      stat(leagueWins.length, "league titles") +
      stat(years.length ? (Math.min.apply(null, years) === Math.max.apply(null, years) ? years[0] : Math.min.apply(null, years) + "–" + Math.max.apply(null, years)) : "—", "on the boards") +
      "</div>" +
      (clubWins.length ? '<p class="muted small">Club titles: ' + Object.keys(byDisc).map(function (d) { return byDisc[d] + " " + d; }).join(", ") + "</p>" : "") +
      '<div class="controls">' + seg("show", [["all", "Everything"], ["club", "Club"], ["league", "League & awards"]], pstate.show) + "</div>" +
      '<div class="panel table-wrap"><table><thead><tr><th>Year</th><th>Competition</th><th>Result</th><th>With</th><th class="hide-sm">Board</th></tr></thead><tbody>' +
      (shown.length ? shown.map(function (r) {
        var partners = r.players.filter(function (x) { return x !== pid; });
        return '<tr><td class="year">' + r.year + "</td><td>" + withCompName(r) + " " + scopeTag(r.c) + "</td><td>" + OUTCOME[r.outcome] +
          (r.score ? " (" + r.score + ")" : "") + (r.joint ? " <span class=\"muted small\">joint</span>" : "") + "</td><td>" +
          partners.map(plink).join(", ") + '</td><td class="hide-sm small">' + sourceLinks(r) + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="empty">Nothing in this view.</td></tr>') + "</tbody></table></div>";
    bindSegs(pstate, function () { playerPage(pid); });
  }

  function decades() {
    var wins = D.results.filter(function (r) { return isWin(r) && inFilter(r); });
    var groups = {};
    wins.forEach(function (r) { var d = decadeOf(r.year); (groups[d] = groups[d] || []).push(r); });
    var ds = Object.keys(groups).map(Number).sort();
    app.innerHTML = "<h1>Wins per decade</h1>" +
      '<p class="lede">The most successful players in each decade. A decade with few results usually means boards are missing for those years (e.g. the 1970s).</p>' +
      filterControls() + '<div class="grid">' + ds.map(function (d) {
        var t = tally(groups[d]).slice(0, 6), max = t.length ? t[0].total : 1;
        return '<div class="panel"><h3>' + d + "s</h3><p class=\"muted small\" style=\"margin:0 0 .5rem\">" + groups[d].length + " titles</p><ul class=\"decade-list\">" +
          t.map(function (e) {
            return "<li><span>" + plink(e.pid) + '</span><span class="muted small">' + e.total + (e.pairs ? " (" + e.pairs + " pairs)" : "") +
              '</span><div class="bar"><i style="width:' + (100 * e.total / max) + '%"></i></div></li>';
          }).join("") + "</ul></div>";
      }).join("") + "</div>";
    bindSegs(filt, decades);
  }

  function competitionsPage() {
    function card(c) {
      var rs = D.results.filter(function (r) { return r.comp === c.id; });
      var ys = rs.map(function (r) { return r.year; });
      var cup = c.names.map(function (n) { return n.name; }).filter(function (n) { return n !== c.name; });
      return '<a class="panel card" href="#/competition/' + c.id + '"><h3>' + esc(c.name) + "</h3>" +
        (cup.length ? '<p class="small" style="margin:0">' + esc(cup.join(" → ")) + "</p>" : "") +
        '<p class="muted small" style="margin:.35rem 0 0">' + scopeTag(c) + " " + esc(c.discipline || "") + " · " +
        (ys.length ? Math.min.apply(null, ys) + "–" + Math.max.apply(null, ys) : "") + " · " + rs.length + " entries</p></a>";
    }
    var saved = filt.scope; filt.scope = "all";
    var club = D.competitions.filter(function (c) { return c.scope === "club" && c.type !== "award"; });
    var league = D.competitions.filter(function (c) { return c.scope !== "club" && c.type !== "award"; });
    var awards = D.competitions.filter(function (c) { return c.type === "award"; });
    app.innerHTML = "<h1>Competitions</h1>" +
      '<p class="lede">Each competition gathers results from every board it appears on, including where a cup changed its name or a board spelt it differently.</p>' +
      "<h2>Club competitions</h2><div class=\"grid\">" + club.map(card).join("") + "</div>" +
      "<h2>League competitions</h2><div class=\"grid\">" + league.map(card).join("") + "</div>" +
      "<h2>Awards</h2><div class=\"grid\">" + awards.map(card).join("") + "</div>";
    filt.scope = saved;
  }

  function competitionPage(cid) {
    var c = comps[cid];
    if (!c) return notFound();
    var rs = D.results.filter(function (r) { return r.comp === cid; });
    var byYear = {};
    rs.forEach(function (r) { (byYear[r.year] = byYear[r.year] || []).push(r); });
    var ys = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
    var rowsHtml = "";
    if (ys.length) {
      for (var y = ys[0]; y <= ys[ys.length - 1]; y++) {
        if (!byYear[y]) {
          if (c.scope === "club") {
            var end = y;
            while (end + 1 <= ys[ys.length - 1] && !byYear[end + 1]) end++;
            rowsHtml += '<tr class="gap"><td class="year">' + y + (end > y ? "–" + end : "") + '</td><td colspan="3">No record on the boards</td></tr>';
            y = end;
          }
          continue;
        }
        byYear[y].sort(function (a, b) { return (a.outcome === "winner" ? 0 : 1) - (b.outcome === "winner" ? 0 : 1); });
        byYear[y].forEach(function (r, i) {
          var who = r.team ? tlink(r.team) : r.players.map(plink).join(" &amp; ");
          var cup = cupName(c, r.year);
          rowsHtml += "<tr><td class=\"year\">" + (i ? "" : y) + "</td><td>" + (r.outcome === "not_played" ? '<span class="muted">Not played</span>' : who) +
            "</td><td>" + (r.outcome === "winner" ? "" : OUTCOME[r.outcome]) + (r.score ? " (" + r.score + ")" : "") + (r.detail ? ' <span class="muted small">' + esc(r.detail) + "</span>" : "") +
            (cup && c.names.length > 1 ? ' <span class="muted small">' + esc(cup) + "</span>" : "") +
            '</td><td class="small hide-sm">' + sourceLinks(r) + "</td></tr>";
        });
      }
    }
    var saved = filt.scope, savedD = filt.disc; filt.scope = "all"; filt.disc = "all";
    var top = tally(rs).slice(0, 5);
    filt.scope = saved; filt.disc = savedD;
    app.innerHTML = '<p class="small"><a href="#/competitions">← All competitions</a></p>' +
      "<h1>" + esc(c.name) + "</h1>" +
      '<p class="lede">' + scopeTag(c) + " " + esc(c.discipline || "") + " · " + esc(c.format) +
      (c.names.length ? " · Trophy: " + c.names.map(function (n) { return esc(n.name) + " (from " + n.from_year + ")"; }).join(", then ") : "") + "</p>" +
      (c.notes ? '<p class="muted small">' + esc(c.notes) + "</p>" : "") +
      (top.length ? '<p>Most wins: ' + top.map(function (e) { return plink(e.pid) + " " + e.total; }).join(" · ") + "</p>" : "") +
      '<div class="panel table-wrap"><table><thead><tr><th>Year</th><th>Name</th><th></th><th class="hide-sm">Board</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>";
  }

  function teamsPage() {
    app.innerHTML = "<h1>Team honours</h1>" +
      '<p class="lede">League successes for the club\'s A–E teams, from the Honours Board and the yearly achievement boards (1988 onwards).</p>' +
      '<div class="grid">' + D.teams.map(function (t) {
        var rs = t.results.slice().sort(function (a, b) { return a.year - b.year; });
        if (!rs.length) return "";
        var w = rs.filter(function (r) { return r.outcome === "winner"; }).length;
        return '<div class="panel"><h3>' + esc(t.name) + '</h3><p class="muted small" style="margin:0 0 .5rem">' + w + " titles · " + (rs.length - w) + " runner-up</p>" +
          '<table class="small"><tbody>' + rs.map(function (r) {
            return '<tr><td class="year">' + r.year + "</td><td>" + (r.outcome === "winner" ? "Winners" : "Runners-up") + ", " +
              esc(r.c.name.replace(/ \((Snooker|Billiards) teams\)/, "")) + (r.detail ? " · " + esc(r.detail) : "") +
              ' <span class="muted">' + esc(r.c.discipline) + "</span></td></tr>";
          }).join("") + "</tbody></table></div>";
      }).join("") + "</div>";
  }

  function insights() {
    var clubWins = D.results.filter(function (r) { return isWin(r) && r.c.scope === "club"; });
    // Streaks: consecutive years winning the same club singles competition.
    var streaks = [];
    D.competitions.filter(function (c) { return c.scope === "club" && c.format === "singles"; }).forEach(function (c) {
      var byYear = {};
      clubWins.filter(function (r) { return r.comp === c.id && r.players.length === 1; }).forEach(function (r) { byYear[r.year] = r.players[0]; });
      Object.keys(byYear).map(Number).sort().forEach(function (y) {
        if (byYear[y - 1] === byYear[y]) return;
        var n = 1;
        while (byYear[y + n] === byYear[y]) n++;
        if (n >= 3) streaks.push({ pid: byYear[y], c: c, from: y, to: y + n - 1, n: n });
      });
    });
    streaks.sort(function (a, b) { return b.n - a.n || a.from - b.from; });
    // Doubles: one player winning two or more club singles titles in the same year.
    var perYear = {};
    clubWins.filter(function (r) { return r.players.length === 1; }).forEach(function (r) {
      var k = r.year + "|" + r.players[0];
      (perYear[k] = perYear[k] || []).push(r);
    });
    var doubles = Object.keys(perYear).filter(function (k) { return perYear[k].length >= 2; }).map(function (k) {
      return { year: +k.split("|")[0], pid: k.split("|")[1], rs: perYear[k] };
    }).sort(function (a, b) { return b.rs.length - a.rs.length || a.year - b.year; });
    // Longest span between first and last club title.
    var spans = tally(clubWins).filter(function (e) { return e.last > e.first; })
      .sort(function (a, b) { return (b.last - b.first) - (a.last - a.first); }).slice(0, 10);
    // Families: surnames shared by several different winners.
    var fam = {};
    var saved = filt.scope; filt.scope = "club";
    tally(clubWins).forEach(function (e) {
      var s = players[e.pid].display_name.split(" ").pop();
      (fam[s] = fam[s] || []).push(e);
    });
    filt.scope = saved;
    var families = Object.keys(fam).filter(function (s) { return fam[s].length >= 3; })
      .map(function (s) { return { s: s, list: fam[s], total: fam[s].reduce(function (a, e) { return a + e.total; }, 0) }; })
      .sort(function (a, b) { return b.total - a.total; });
    // Partnerships.
    var pairs = {};
    clubWins.filter(function (r) { return r.players.length === 2; }).forEach(function (r) {
      var k = r.players.slice().sort().join("|");
      (pairs[k] = pairs[k] || []).push(r.year);
    });
    var bestPairs = Object.keys(pairs).filter(function (k) { return pairs[k].length >= 2; })
      .sort(function (a, b) { return pairs[b].length - pairs[a].length; });
    // Highest breaks.
    var breaks = D.results.filter(function (r) { return r.outcome === "highest_break" && r.score; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 10);

    app.innerHTML = "<h1>Insights</h1>" +
      '<div class="grid">' +
      panel("Winning streaks", "Three or more consecutive years winning the same club competition.",
        streaks.map(function (s) { return "<li>" + plink(s.pid) + " — " + clink(s.c) + ' <span class="muted">' + s.from + "–" + s.to + " (" + s.n + ")</span></li>"; })) +
      panel("Doubles", "Two or more club singles titles in the same year.",
        doubles.map(function (d) { return '<li><span class="year">' + d.year + "</span> " + plink(d.pid) + ' <span class="muted small">' + d.rs.map(function (r) { return esc(r.c.name); }).join(", ") + "</span></li>"; })) +
      panel("Longest careers", "Most years between first and last club title.",
        spans.map(function (e) { return "<li>" + plink(e.pid) + ' <span class="muted">' + e.first + "–" + e.last + " (" + (e.last - e.first) + " years)</span></li>"; })) +
      panel("Club families", "Surnames shared by three or more different club winners. They may or may not be related.",
        families.map(function (f) { return "<li><b>" + esc(f.s) + "</b> — " + f.total + " titles: " + f.list.map(function (e) { return plink(e.pid) + " " + e.total; }).join(", ") + "</li>"; })) +
      panel("Partnerships", "Pairs who won the club pairs competition together more than once.",
        bestPairs.map(function (k) { return "<li>" + k.split("|").map(plink).join(" &amp; ") + ' <span class="muted">' + pairs[k].join(", ") + "</span></li>"; })) +
      panel("Highest breaks recorded", "From the league achievement boards.",
        breaks.map(function (r) { return "<li><b>" + r.score + "</b> " + plink(r.players[0]) + ' <span class="muted small">' + r.year + " · " + esc(r.c.discipline) + (r.detail ? " · " + esc(r.detail) : "") + "</span></li>"; })) +
      "</div>";
  }
  function panel(title, sub, items) {
    return '<div class="panel"><h3>' + esc(title) + '</h3><p class="muted small" style="margin:0 0 .5rem">' + esc(sub) + "</p>" +
      (items.length ? '<ul class="small" style="padding-left:1.1rem;margin:0">' + items.join("") + "</ul>" : '<p class="empty">None.</p>') + "</div>";
  }

  function boardsPage() {
    app.innerHTML = "<h1>The boards</h1>" +
      '<p class="lede">The photographs these records were transcribed from. Open a board to check the transcription line by line.</p>' +
      '<div class="grid">' + D.boards.map(function (b) {
        return '<a class="panel card board-thumb" href="#/board/' + b.id + '"><img loading="lazy" src="photos/' + esc(b.photo) + '" alt="' + esc(b.title) + '">' +
          "<h3>" + esc(b.title) + '</h3><p class="muted small" style="margin:0">' + b.id + "</p></a>";
      }).join("") + "</div>";
  }

  function boardPage(bid) {
    var b = boards[bid];
    if (!b) return notFound();
    var rs = D.raw.filter(function (r) { return r.board_id === bid; });
    app.innerHTML = '<p class="small"><a href="#/boards">← All boards</a></p><h1>' + esc(b.title) + "</h1>" +
      '<div class="panel board-photo"><a href="photos/' + esc(b.photo) + '" target="_blank" rel="noopener"><img src="photos/' + esc(b.photo) + '" alt="Photo of ' + esc(b.title) + '"></a></div>' +
      '<div class="panel table-wrap"><table><thead><tr><th>Year</th><th>As painted</th><th>Read as</th></tr></thead><tbody>' +
      rs.map(function (r) {
        var read = r.results.map(function (x) {
          var who = x.team ? esc(teams[x.team].name) : x.players.map(plink).join(" &amp; ");
          return (x.outcome === "not_played" ? "Not played" : who + " — " + OUTCOME[x.outcome]) + ", " + clink(x.c) + (x.detail ? " · " + esc(x.detail) : "");
        }).join("<br>");
        if (r.status === "ignored") read = '<span class="muted">' + esc(r.status_note) + "</span>";
        if (r.status === "error") read = '<span class="tag warn">Not read</span>';
        if (b.kind === "members") read = "Honorary member";
        return '<tr><td class="year">' + (r.year || "") + "</td><td>" + esc(r.raw_text) +
          (r.column ? '<div class="muted small">' + esc(r.column) + "</div>" : "") +
          (r.note ? '<div class="small"><span class="tag warn">Note</span> ' + esc(r.note) + "</div>" : "") + "</td><td class=\"small\">" + read + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function checkPage() {
    var cands = (D.candidates || []);
    var open = cands.filter(function (c) { return c.decision !== "merge" && c.decision !== "separate"; });
    var issues = D.issues.filter(function (i) { return i.kind !== "identity" && i.kind !== "duplicate"; });
    function nameLink(n) {
      var a = D.aliases.filter(function (x) { return x.alias === n; })[0];
      return a ? plink(a.player_id) : esc(n);
    }
    app.innerHTML = "<h1>Data check</h1>" +
      '<p class="lede">Things worth checking against the boards. Fixes go in the project\'s data files; then rebuild.</p>' +
      "<h2>Possibly the same person (" + open.length + " to decide)</h2>" +
      '<p class="muted small">Boards often give only initials, so these are kept as separate people until someone who knows the club confirms them in <code>review/candidates.csv</code>.</p>' +
      '<div class="panel table-wrap"><table><thead><tr><th>Name A</th><th>Name B</th><th>Why</th><th>Decision</th></tr></thead><tbody>' +
      (cands.length ? cands.map(function (c) {
        return "<tr><td>" + nameLink(c.name_a) + '<div class="muted small">' + esc(c.a_seen) + "</div></td><td>" + nameLink(c.name_b) +
          '<div class="muted small">' + esc(c.b_seen) + '</div></td><td class="small">' + esc(c.reason) + ' <span class="tag">' + esc(c.likelihood) +
          "</span></td><td>" + (c.decision ? esc(c.decision) : '<span class="tag warn">to decide</span>') + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="empty">None.</td></tr>') + "</tbody></table></div>" +
      "<h2>Notes and corrections</h2>" +
      '<div class="panel table-wrap"><table><thead><tr><th>Entry</th><th>Note</th></tr></thead><tbody>' +
      issues.map(function (i) {
        var r = raws[i.raw_entry_id];
        return "<tr><td>" + (r ? '<a href="#/board/' + r.board_id + '">' + r.board_id + "</a> " + (r.year || "") + "<div class=\"small\">" + esc(r.raw_text) + "</div>" : "") +
          '</td><td class="small"><span class="tag ' + (i.severity === "info" ? "" : "warn") + '">' + esc(i.kind) + "</span> " + esc(i.message) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function notFound() { app.innerHTML = '<h1>Not found</h1><p><a href="#/">Back to the start</a></p>'; }

  // ---------- router ----------
  function route() {
    var parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    var page = parts[0], arg = decodeURIComponent(parts[1] || "");
    var routes = {
      "": home, leaderboard: leaderboard, players: playersPage, decades: decades, competitions: competitionsPage,
      teams: teamsPage, insights: insights, boards: boardsPage, check: checkPage,
      player: function () { playerPage(arg); }, competition: function () { competitionPage(arg); }, board: function () { boardPage(arg); }
    };
    (routes[page] || notFound)();
    var navKey = { player: "players", competition: "competitions", board: "boards" }[page] || page;
    document.querySelectorAll("#nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#/" + navKey); });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
