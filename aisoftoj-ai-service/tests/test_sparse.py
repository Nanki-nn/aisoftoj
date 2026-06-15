from aisoftoj_ai.rag.sparse import sparse_vector


def test_sparse_vector_is_stable_and_sorted():
    first = sparse_vector("数据库 数据库 一致性")
    second = sparse_vector("数据库 数据库 一致性")

    assert first == second
    assert first.indices == sorted(first.indices)
    assert len(first.indices) == 2
