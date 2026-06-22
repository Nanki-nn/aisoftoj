import base64
import gzip
import json
import time
from typing import Any, Dict, List, Optional, Tuple

import requests


BASE_URL = "https://fangcaicoding.cn"

SALT = "FANGCAI_BLOG_2024"
XOR_KEY = 85


def deobfuscate(value: Optional[str]) -> Optional[str]:
    """
    还原 fangcaicoding 的 intro / answer / analysis 字段。
    对应前端 DataObfuscation.deobfuscate。
    """
    if value is None:
        return None

    if not isinstance(value, str):
        return value

    if value.strip() == "":
        return value

    try:
        # URL-safe Base64 变体还原
        b64 = value.replace(".", "+").replace("-", "/")
        b64 += "=" * ((4 - len(b64) % 4) % 4)

        compressed = base64.b64decode(b64)

        # gzip 解压
        data = bytearray(gzip.decompress(compressed))

        # 字节还原
        for r in range(len(data)):
            p = r % 3 + 1
            d = XOR_KEY + r % 4
            data[r] = ((data[r] ^ d) - p) & 255

        text = data.decode("utf-8")

        # 去掉固定盐值
        if text.startswith(SALT):
            text = text[len(SALT):]

        return text

    except Exception:
        # 解码失败时保留原文，方便排查
        return value


def make_session(cookie: str = "") -> requests.Session:
    session = requests.Session()

    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Referer": f"{BASE_URL}/",
    })

    # 如果接口不需要登录，可以留空。
    # 如果返回 401 / 403，再从浏览器请求头里复制 Cookie 到这里。
    if cookie:
        session.headers.update({
            "Cookie": cookie
        })

    return session


def request_json(
    session: requests.Session,
    url: str,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 15,
) -> Dict[str, Any]:
    resp = session.get(url, params=params, timeout=timeout)
    resp.raise_for_status()

    data = resp.json()

    if data.get("code") != 200 or data.get("success") is False:
        raise RuntimeError(f"接口返回异常: {data}")

    return data


def fetch_paper_record(
    session: requests.Session,
    paper_id: int,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    请求：
    /api/paper/public/record/detail/{paperId}

    返回：
    paper 元信息 + questionList
    """
    url = f"{BASE_URL}/api/paper/public/record/detail/{paper_id}"

    data = request_json(session, url)
    root = data.get("data") or {}

    # 根据你截图，结构大概率是：
    # data: {
    #   paper: {...},
    #   questionList: [...]
    # }
    if isinstance(root.get("paper"), dict):
        paper = root["paper"]
        question_list = root.get("questionList") or paper.get("questionList") or []
    else:
        # 兼容另一种结构：
        # data: {
        #   id, name, questionTotal, ...,
        #   questionList: [...]
        # }
        question_list = root.get("questionList") or []
        paper = {
            k: v
            for k, v in root.items()
            if k != "questionList"
        }

    return paper, question_list


def fetch_question_detail(
    session: requests.Session,
    question_id: int,
    with_answer: bool = True,
    with_analysis: bool = True,
) -> Dict[str, Any]:
    """
    请求：
    /api/paper/public/question/{questionId}?withAnswer=true&withAnalysis=true
    """
    url = f"{BASE_URL}/api/paper/public/question/{question_id}"

    params = {
        "withAnswer": str(with_answer).lower(),
        "withAnalysis": str(with_analysis).lower(),
    }

    data = request_json(session, url, params=params)
    q = data.get("data") or {}

    # 替换成解码后的内容
    q["intro"] = deobfuscate(q.get("intro"))
    q["answer"] = deobfuscate(q.get("answer"))
    q["analysis"] = deobfuscate(q.get("analysis"))

    # 额外补一个正确选项，方便后续使用
    q["correctOptions"] = [
        opt.get("keyStr")
        for opt in q.get("options", [])
        if opt.get("correct") is True
    ]

    return q


def crawl_paper(
    paper_id: int,
    cookie: str = "",
    sleep_seconds: float = 0.5,
) -> Dict[str, Any]:
    session = make_session(cookie=cookie)

    paper, question_metas = fetch_paper_record(session, paper_id)

    questions: List[Dict[str, Any]] = []

    # 从 questionList 取题目 id
    question_ids = []
    for item in question_metas:
        qid = item.get("id")
        if qid is not None:
            question_ids.append(int(qid))

    # 去重，保持原始顺序
    seen = set()
    question_ids = [
        qid
        for qid in question_ids
        if not (qid in seen or seen.add(qid))
    ]

    for index, question_id in enumerate(question_ids, start=1):
        try:
            detail = fetch_question_detail(
                session,
                question_id,
                with_answer=True,
                with_analysis=True,
            )

            # 把 record/detail 里的状态信息也并进去
            meta = next(
                (x for x in question_metas if int(x.get("id")) == question_id),
                {},
            )

            detail["_paperQuestionMeta"] = meta
            detail["_indexInPaper"] = index

            questions.append(detail)

            print(f"[{index}/{len(question_ids)}] OK question_id={question_id}")

            time.sleep(sleep_seconds)

        except Exception as e:
            print(f"[{index}/{len(question_ids)}] FAIL question_id={question_id}: {e}")

            questions.append({
                "id": question_id,
                "_indexInPaper": index,
                "_error": str(e),
            })

            time.sleep(sleep_seconds)

    result = {
        "paper": paper,
        "questions": questions,
    }

    return result


if __name__ == "__main__":
    paper_id = 66582

    # 一般可以留空。
    # 如果返回 401 / 403，把浏览器 Network 里的 Cookie 整段复制到这里。
    COOKIE = "FC_CLIENT_ID=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJVc2VyVG9rZW4iOiI2YzZiNGY0ZDcwZjYxNGU3MmU4YjIyNWM2ZDE0NzYwNmMyYmZkZTk5NzQ4ZGUxNGU4YjRlMGM0NTAyNjJkNmM0IiwiZXhwIjoxNzgzNTcyMjMzLCJpYXQiOjE3ODA5ODAyMzN9.BgbuOGC_UE94b5ghQAJc61jv-k4CqfwxIhuShSke_C-E86-tj56NJ8_2y_FU1LrgSqZ2bKrkgHUBEZo5vU32CQ; Hm_lvt_5a39193ea2d1393d15f3d397d86a9c8d=1780980235,1781877444; HMACCOUNT=E49E9EEEB4F17AD8; Hm_lpvt_5a39193ea2d1393d15f3d397d86a9c8d=1781877447; FC_USER_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJVc2VyVG9rZW4iOiI4ZjhiYzdiZjQyYTgzNDkwN2U5Y2M1NWVhM2MxMGFlMTU0YjFiNzY2YTJiMjBkNDA5ZTk0ZTllYWI3ZTc5Nzk3MGQwZWNjMWVjZGYyYzEzMjJjZjgyZjk3YzlkMGRiMDYxZGIzNTkxYzg0ZDllMWNiYWNkYTViN2ZhZjc1YTNjNyIsImV4cCI6MTc4NDQ2OTUwOSwiaWF0IjoxNzgxODc3NTA5fQ.stXtNiEPJN4m98qEnoeN51beM2X_Ixvwql9BRLC4xupQ1ooHyPNuvoUya5pghuGAJbreDX9__z9fP-GLHSs8qA"

    result = crawl_paper(
        paper_id=paper_id,
        cookie=COOKIE,
        sleep_seconds=0.5,
    )

    output_file = f"综合知识_{paper_id}.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"已保存: {output_file}")