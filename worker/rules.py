"""担当の判定（純粋関数）。GitHub API の結果を受け取り、何をするかを決める。

API を呼ぶのは `github.py`、組み立ては `__main__.py`。ここは入出力を持たず、`worker/tests/` でテストする。
数値と文は「独立に向けた開発の管理」の体制設計タブ（部品3）に合わせる。変えるときはタブを先に直す。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

JST = timezone(timedelta(hours=9))

# ラベル（templates/labels.py の LABELS と同じ名前）
IDEA = "案"
READY = "着手可"
WORKING = "作業中"
REVIEW = "承認待ち"
DONE = "完了"

DAILY_LIMIT = 3  # 1日（日本時間）に着手する件数の上限
MONTHLY_MINUTES = 900  # 1か月（日本時間の暦月）に担当が使う Actions の分の上限。非公開リポジトリだけ（公開は実行時間が無料）
WORK_MINUTES = 40  # 1回の作業時間の上限（ワークフローの手順の timeout-minutes と同じ値に保つ）
BOT_LOGIN = "github-actions[bot]"  # ワークフローの標準のトークンでラベルを付けたときの名前
BRANCH_PREFIX = "claude/issue-"
JOURNAL_DIR = "journal/"
WORKFLOWS_DIR = ".github/workflows/"


def parse_time(value: str) -> datetime:
    """GitHub の日時（例：2026-09-29T01:02:03Z）を時間帯付きの datetime にする。"""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def day_start(now: datetime) -> datetime:
    """日本時間でその日の0時。"""
    local = now.astimezone(JST)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def month_start(now: datetime) -> datetime:
    """日本時間でその月の1日0時。"""
    return day_start(now).replace(day=1)


def today(now: datetime) -> str:
    """日本時間の日付（作業日誌のファイル名に使う）。"""
    return now.astimezone(JST).strftime("%Y-%m-%d")


def ready_labeled_at(events: Iterable[dict], owner_id: int) -> Optional[datetime]:
    """Issue のイベント履歴から、最後に「着手可」を付けたのが持ち主なら、その日時を返す。

    持ち主以外が最後に付けた・一度も付いていないなら None（着手しない）。
    """
    last = None
    for event in events:
        if event.get("event") == "labeled" and (event.get("label") or {}).get("name") == READY:
            if last is None or parse_time(event["created_at"]) >= parse_time(last["created_at"]):
                last = event
    if last is None or (last.get("actor") or {}).get("id") != owner_id:
        return None
    return parse_time(last["created_at"])


def written_by_owner(issue: dict, owner_id: int) -> bool:
    """指示書（Issue）を書いたのが持ち主か。

    本文とタイトルは書いた本人が後から直せるため、持ち主以外が書いた Issue は「着手可」が付いていても着手しない
    （公開リポジトリでは誰でも Issue を立てられる）。
    """
    return (issue.get("user") or {}).get("id") == owner_id


def not_owner_comment() -> str:
    return (
        "持ち主以外が書いた指示書には着手しません（本文を後から書き換えられるため）。"
        "中身を写して、持ち主が指示書を立て直してください。"
    )


def issue_file(issue: dict) -> str:
    """担当に渡す指示書（.worker/issue.md）。タイトルと本文だけで、コメントは含めない（誰でも書けるため）。"""
    return f"# {issue['title']}\n\n{issue.get('body') or ''}\n"


@dataclass(frozen=True)
class Candidate:
    number: int
    title: str
    labeled_at: datetime


def order_queue(candidates: Iterable[Candidate]) -> list[Candidate]:
    """着手の順番：「着手可」が付いた順（同時なら Issue 番号の小さい順）。"""
    return sorted(candidates, key=lambda c: (c.labeled_at, c.number))


def count_started_today(repo_events: Iterable[dict], now: datetime) -> int:
    """今日（日本時間）、担当が「作業中」を付けた回数（＝着手した件数）。"""
    start = day_start(now)
    return sum(
        1
        for event in repo_events
        if event.get("event") == "labeled"
        and (event.get("label") or {}).get("name") == WORKING
        and (event.get("actor") or {}).get("login") == BOT_LOGIN
        and parse_time(event["created_at"]) >= start
    )


def job_minutes(jobs: Iterable[dict]) -> int:
    """終わったジョブの使用時間（分）の合計。GitHub と同じく、ジョブごとに分単位で切り上げる。"""
    total = 0
    for job in jobs:
        if not job.get("started_at") or not job.get("completed_at"):
            continue
        seconds = (parse_time(job["completed_at"]) - parse_time(job["started_at"])).total_seconds()
        if seconds > 0:
            total += math.ceil(seconds / 60)
    return total


def monthly_limit(private: bool) -> Optional[int]:
    """月の使用時間の上限。公開リポジトリは Actions の実行時間が無料なので上限なし（None）。"""
    return MONTHLY_MINUTES if private else None


def limit_reason(started_today: int, minutes_this_month: Optional[int], monthly: Optional[int] = MONTHLY_MINUTES) -> Optional[str]:
    """上限に達していれば、その理由の文。達していなければ None。monthly が None なら月の上限は見ない。"""
    if monthly is not None and minutes_this_month is not None and minutes_this_month >= monthly:
        return (
            f"今月の担当の使用時間が上限（{monthly}分）に達しました（{minutes_this_month}分）。"
            "非公開リポジトリの Actions の無料枠（アカウント全体で共有）を見張りのために残すため、今月はもう着手しません。来月以降に、もう一度「着手可」を付けてください。"
        )
    if started_today >= DAILY_LIMIT:
        return (
            f"今日（日本時間）の着手の上限（{DAILY_LIMIT}件）に達しました。"
            "明日以降に、もう一度「着手可」を付けてください。"
        )
    return None


def check_changes(changed_paths: Iterable[str]) -> Optional[str]:
    """担当の変更を提案として出せるか。出せなければ理由の文。"""
    paths = [p.strip().strip('"') for p in changed_paths if p.strip()]
    if not paths:
        return "変更がありませんでした。"
    if any(p.startswith(WORKFLOWS_DIR) for p in paths):
        return "ワークフロー（.github/workflows/）の変更は、担当の権限では反映できません。社長の手元で行ってください。"
    if not any(p.startswith(JOURNAL_DIR) and p.endswith(".md") for p in paths):
        return "作業日誌（journal/<日付>.md）がありませんでした。"
    return None


def failure_reason(
    *,
    finish_reason: Optional[str],
    cannot_complete: Optional[str],
    claude_outcome: str,
    elapsed_seconds: Optional[float],
) -> str:
    """「案」に戻すときの理由の文。分かっている理由を優先する。"""
    if finish_reason:
        return finish_reason
    if cannot_complete and cannot_complete.strip():
        return "担当が完了できないと判断しました：" + shorten(cannot_complete.strip())
    # 手順の時間切れは失敗として記録される。上限の少し手前からを時間切れとみなす
    if claude_outcome in ("failure", "cancelled") and elapsed_seconds is not None and elapsed_seconds >= (WORK_MINUTES - 1) * 60:
        return (
            f"作業時間の上限（{WORK_MINUTES}分）に達しました。担当の失敗ではなく、指示書が大きすぎた合図です。"
            "分けて出し直してください。"
        )
    if claude_outcome == "failure":
        return "担当の実行が途中で失敗しました（トークンの期限切れ・利用枠の不足なども含む）。実行ページで確かめてください。"
    return "作業が途中で止まりました。実行ページで確かめてください。"


def shorten(text: str, limit: int = 1000) -> str:
    return text if len(text) <= limit else text[:limit] + "…（以下略）"


def revert_comment(reason: str, run_url: str) -> str:
    return f"「案」に戻しました。\n\n理由：{reason}\n\n実行ページ：{run_url}"


def branch_name(issue_number: int, run_id: str) -> str:
    """作業用の枝の名前。実行ごとに変えて、前の試みの枝とぶつからないようにする。"""
    return f"{BRANCH_PREFIX}{issue_number}-{run_id}"


def is_work_branch(branch: str) -> bool:
    """push してよい枝か（担当は main に直接反映しない）。"""
    return branch.startswith(BRANCH_PREFIX) and branch not in ("main", "master")


def pr_body(claude_body: Optional[str], issue_number: int, run_url: str) -> str:
    """提案の本文。担当が書いた説明に、Issue を閉じる記述と実行ページを添える。"""
    body = (claude_body or "").strip() or "（担当が説明を書きませんでした。変更と作業日誌を見てください）"
    return f"{body}\n\nCloses #{issue_number}\n\n---\n担当（Claude Code）が作成。実行ページ：{run_url}"
