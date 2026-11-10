# 人工审核台账（Human Approvals）

> 本文件只记录**两类需要人类点头**的事情：
> ① 物理删除 `design/` 下的记录或设计性资产；② 推翻 `README.md` §1 的设计公理。
> **AI 只能写 `pending` 行，不能自己填 `approved`。**

## 状态说明

| 状态 | 含义 |
|---|---|
| `pending` | 已申请，等待人类审核 |
| `approved` | 人类已批准（必须填姓名 + 日期） |
| `rejected` | 人类否决（必须填理由），对应操作不得执行 |
| `done` | 已执行完毕，原位置已留墓碑说明 |

## 申请模板

```markdown
### AP-YYYYMMDD-NNN · <一句话说明>
- 类型：delete-record | delete-asset | axiom-override
- 目标：<文件 / 记录 id / 公理编号>
- 理由：<为什么必须删除或推翻，不能改状态代替>
- 替代方案：<删除后信息如何保留>
- 申请人 / 日期：<name> / <YYYY-MM-DD>
- 审核人 / 日期 / 关联 commit：pending
- 状态：pending
```

## 台账

| id | 类型 | 目标 | 状态 | 申请人 | 审核人 |
|---|---|---|---|---|---|
| — | — | 暂无 | — | — | — |
