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


# 提案が閉じた時（worker pr-closed）

class FakeIssues:
    def __init__(self, labels, state="open"):
        self.state = state
        self.labels = set(labels)
        self.closed = 0
        self.comments = []

    def issue(self, number):
        return {"state": self.state, "labels": [{"name": n} for n in self.labels]}

    def close_issue(self, number):
        self.state = "closed"
        self.closed += 1

    def relabel(self, number, remove, add):
        self.labels -= set(remove)
        self.labels |= set(add)

    def comment(self, number, body):
        self.comments.append((number, body))


def event(merged, ref="claude/issue-2-36729498995", repo="mikotorei/example"):
    return {
        "repository": {"full_name": "mikotorei/example", "default_branch": "main"},
        "pull_request": {
            "number": 3,
            "html_url": "https://github.com/mikotorei/example/pull/3",
            "merged": merged,
            "head": {"ref": ref, "repo": {"full_name": repo}},
            "base": {"ref": "main"},
        },
    }


def test_反映されたらIssueを閉じて完了にする():
    gh = FakeIssues({"承認待ち"})
    main.pr_closed(gh, event(merged=True))
    assert gh.state == "closed" and gh.closed == 1
    assert gh.labels == {"完了"}
    assert gh.comments == []


def test_本文のClosesで閉じていても完了にする_二重には閉じない():
    gh = FakeIssues({"承認待ち"}, state="closed")
    main.pr_closed(gh, event(merged=True))
    assert gh.closed == 0 and gh.labels == {"完了"}


def test_反映されずに閉じたら案に戻してコメントする():
    gh = FakeIssues({"承認待ち"})
    main.pr_closed(gh, event(merged=False))
    assert gh.state == "open" and gh.closed == 0
    assert gh.labels == {"案"}
    assert len(gh.comments) == 1 and "反映されずに閉じられた" in gh.comments[0][1]


def test_承認待ちが無いIssueや担当以外の提案には触らない():
    for gh, ev in (
        (FakeIssues({"完了"}, state="closed"), event(merged=True)),  # 手で片づけ済み
        (FakeIssues({"案"}), event(merged=False)),
        (FakeIssues({"承認待ち"}), event(merged=True, ref="ccr-abc")),
        (FakeIssues({"承認待ち"}), event(merged=True, repo="someone/fork")),
    ):
        before = set(gh.labels)
        main.pr_closed(gh, ev)
        assert gh.labels == before and gh.closed == 0 and gh.comments == []


def test_ラベルを外す時に別の実行が先に外していても失敗しない():
    from worker.github import GitHub

    class Res:
        def __init__(self, status, data=None):
            self.status_code = status
            self._data = data
            self.content = b"x" if data is not None else b""

        def json(self):
            return self._data

    calls = []

    class Session:
        headers = {}

        def request(self, method, url, **kwargs):
            calls.append(method)
            if method == "GET":
                return Res(200, {"labels": [{"name": "承認待ち"}]})
            if method == "DELETE":
                return Res(404, {"message": "Label does not exist"})
            return Res(200, [])

    gh = GitHub("mikotorei/example", "t")
    gh.session = Session()
    gh.relabel(2, remove=["承認待ち"], add=["完了"])
    assert calls == ["GET", "DELETE", "POST"]
