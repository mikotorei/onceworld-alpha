"""待ち行列の選び方（連鎖して次の実行を起動する時も同じ関数を通る）。GitHub の代わりに偽物を使う。"""

from worker import __main__ as main

OWNER = 262788924


def labeled(name, at, actor_id):
    return {"event": "labeled", "label": {"name": name}, "created_at": at, "actor": {"id": actor_id}}


class FakeGitHub:
    def __init__(self, issues, events, private=False):
        self.issues = issues
        self.events = events
        self.private = private
        self.relabeled = []
        self.comments = []
        self.dispatched = 0

    def info(self):
        return {"owner": {"id": OWNER}, "private": self.private}

    def ready_issues(self):
        return self.issues

    def issue_events(self, number):
        return self.events[number]

    def issue(self, number):
        return next(i for i in self.issues if i["number"] == number)

    def relabel(self, number, remove, add):
        self.relabeled.append((number, tuple(remove), tuple(add)))

    def comment(self, number, body):
        self.comments.append((number, body))

    def repo_events_since(self, since):
        return []

    def worker_minutes_since(self, since):
        raise AssertionError("公開リポジトリでは使用時間を数えない")

    def dispatch_worker(self):
        self.dispatched += 1


def issue(number, author):
    return {"number": number, "title": f"題{number}", "body": "本文", "user": {"id": author}}


def fake():
    return FakeGitHub(
        issues=[issue(1, OWNER), issue(2, 999), issue(3, OWNER), issue(4, 999)],
        events={
            1: [labeled("着手可", "2026-09-30T02:00:00Z", OWNER)],
            2: [labeled("着手可", "2026-09-30T01:00:00Z", OWNER)],  # 持ち主以外が書いた
            3: [labeled("着手可", "2026-09-30T01:30:00Z", 999)],  # 持ち主以外が付けた
            4: [labeled("着手可", "2026-09-30T00:30:00Z", 999)],  # どちらも持ち主以外
        },
    )


def test_待ち行列は持ち主が書き持ち主が付けたものだけ():
    waiting, others = main.queue(fake())
    assert [c.number for c in waiting] == [1]
    assert others == [2]


def test_連鎖の起動も同じ条件で数える():
    gh = fake()
    gh.issues = [issue(2, 999), issue(3, OWNER)]
    main.next_run(gh)
    assert gh.dispatched == 0


def test_pickは持ち主以外が書いたものを案に戻し_タイトルと本文だけを渡す(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("GITHUB_RUN_ID", "5")
    monkeypatch.setenv("GITHUB_REPOSITORY", "mikotorei/example")
    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_OUTPUT", str(tmp_path / "out"))
    gh = fake()
    assert main.pick(gh) == 0
    assert (2, ("着手可",), ("案",)) in gh.relabeled
    assert any(n == 2 and "持ち主以外が書いた" in body for n, body in gh.comments)
    assert (1, ("着手可",), ("作業中",)) in gh.relabeled
    assert (tmp_path / ".worker/issue.md").read_text(encoding="utf-8") == "# 題1\n\n本文\n"
    assert "issue=1\n" in (tmp_path / "out").read_text(encoding="utf-8")
