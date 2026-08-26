# 教材 RAG 数据初始化

首版只面向《系统架构设计师教程》，但教材元数据不写死在代码中。上线前由管理员
确认具体版次、ISBN 和官方或授权下载地址，再把目录和两套页码写入 Java 业务库。
不要把第三方网盘、不明转载 PDF 或未经确认的地址填入 `official_url`。

## 数据顺序

1. 写入一条 `textbook`，初始状态使用 `DRAFT`。
2. 写入完整的 `textbook_section` 章节树。`printed_page_*` 是书本印刷页码，
   `pdf_page_*` 是 PDF 阅读器从 1 开始的实际页序号。
3. 写入一级、二级 `knowledge_point`。
4. 通过 `knowledge_point_source` 把知识点绑定到章节和可信页码范围。
5. 启用 AI 配置，通过管理员索引 API 建立索引。
6. 检查索引任务为 `completed` 后，把教材状态改为 `ACTIVE`。数据库唯一约束保证
   同一科目最多只有一条 `ACTIVE` 教材。

## 最小 SQL 示例

下面只展示字段关系，不是完整目录。执行前必须替换版次、ISBN、地址和真实页码：

```sql
START TRANSACTION;

INSERT INTO textbook (
  subject_name, name, edition, isbn, official_url, viewer_page_template, status
) VALUES (
  '系统架构设计师',
  '系统架构设计师教程',
  '请填写真实版次',
  NULL,
  'https://请替换为已确认的官方或授权下载地址',
  'https://请替换为已确认的官方或授权下载地址#page={pdfPage}',
  'DRAFT'
);
SET @textbook_id = LAST_INSERT_ID();

INSERT INTO textbook_section (
  textbook_id, parent_id, level, section_code, title,
  printed_page_start, printed_page_end, pdf_page_start, pdf_page_end, sort_order
) VALUES (
  @textbook_id, NULL, 1, '第1章', '请填写真实章节名',
  1, 20, 7, 26, 1
);
SET @section_id = LAST_INSERT_ID();

INSERT INTO knowledge_point (
  subject_name, parent_id, level, code, name, description, status
) VALUES (
  '系统架构设计师', NULL, 1, 'ARCH.EXAMPLE',
  '请填写真实知识点', '请填写简短定义', 'ACTIVE'
);
SET @knowledge_point_id = LAST_INSERT_ID();

INSERT INTO knowledge_point_source (
  knowledge_point_id, textbook_section_id,
  printed_page_start, printed_page_end, pdf_page_start, pdf_page_end, is_primary
) VALUES (
  @knowledge_point_id, @section_id, 1, 3, 7, 9, 1
);

COMMIT;
```

## 触发索引

管理员登录后使用现有 Bearer JWT：

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_JWT" \
  http://127.0.0.1:8000/api/ai/admin/textbooks/$TEXTBOOK_ID/indexes
```

返回 `taskId` 后查询：

```bash
curl \
  -H "Authorization: Bearer $ADMIN_JWT" \
  http://127.0.0.1:8000/api/ai/admin/textbook-index-tasks/$TASK_ID
```

索引成功后再激活教材：

```sql
UPDATE textbook
SET status = 'ACTIVE'
WHERE id = @textbook_id AND is_deleted = 0;
```

Agent 只会读取 `ACTIVE` 教材和 `ACTIVE` 索引。用户无法通过 Agent 修改教材、目录、
知识点或索引。
