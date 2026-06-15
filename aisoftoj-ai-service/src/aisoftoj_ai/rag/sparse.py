import math
import re
import zlib
from collections import Counter

import jieba
from qdrant_client import models

TOKEN_PATTERN = re.compile(r"[\w\u4e00-\u9fff]+")


def sparse_vector(text: str) -> models.SparseVector:
    """基于 jieba 分词和哈希构建稀疏向量。"""
    tokens = [
        token.lower()
        for token in jieba.lcut(text)
        if TOKEN_PATTERN.fullmatch(token) and token.strip()
    ]
    counts = Counter(tokens)
    values = {
        zlib.crc32(token.encode()) & 0xFFFFFFFF: 1 + math.log(count)
        for token, count in counts.items()
    }
    indices = sorted(values)
    return models.SparseVector(indices=indices, values=[values[index] for index in indices])
