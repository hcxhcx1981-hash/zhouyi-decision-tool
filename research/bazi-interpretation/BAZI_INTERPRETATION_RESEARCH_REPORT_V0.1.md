# 八字基础命理解读规则研究报告 V0.1（Phase 2.5A）

状态：`RESEARCH_CANDIDATE_NOT_FOR_RUNTIME`
tradition_scope：`ZIPING_BAZI`
日期：2026-08-12

## 1. 研究范围与目标

本轮研究"命理结构对传统命理分析意味着什么"的解释层，产出 `BAZI_INTERPRETATION_PROTOCOL_V0.1` 候选：即"未来命理解读引擎允许怎么说"的规则候选，而不是命理解读本身。

只研究十神传统语义、数量解释边界、透干/藏干差异、柱位语义、日主定义、旺衰依赖研究；不实现旺衰、不选流派、不写评分公式、不开发 runtime。

## 2. 来源与等级

- L1（经典）：渊海子平（维基文库/ctext 转录）、滴天髓（含任铁樵注）、子平真诠、三命通会
- L2（现代教材）：千里命稿（韦千里）、命理探源（袁树珊）
- L3（交叉核对）：现代子平入门教材通用口径；另登记"常见误用反例集"（算命网站/自媒体/论坛等，仅作 PROHIBITED 反例，不作证据）

## 3. 十神 10 类基础语义结论

10 类十神均有稳定传统基础语义（结构定义来自 foundation 公式 + 经典文献支撑）：

| 十神 | 传统主题（SAFE_GLOSS 层） | gate |
|---|---|---|
| 比肩 | 同辈、朋友、自我、竞争、独立 | SAFE_SEMANTIC_GLOSS |
| 劫财 | 同辈、合作、分夺、争夺 | SAFE_SEMANTIC_GLOSS |
| 食神 | 才华、表达、享受、福气 | SAFE_SEMANTIC_GLOSS |
| 伤官 | 才华、创造力、个性、叛逆 | SAFE_SEMANTIC_GLOSS |
| 正财 | 正当收入、稳定财富、勤劳 | SAFE_SEMANTIC_GLOSS |
| 偏财 | 投资机遇、社交人脉 | SAFE_SEMANTIC_GLOSS |
| 七杀 | 约束、压力、竞争、规则、责任 | SAFE_SEMANTIC_GLOSS |
| 正官 | 规则、责任、纪律、名誉 | SAFE_SEMANTIC_GLOSS |
| 偏印 | 特殊学识、灵感、深度思考 | SAFE_SEMANTIC_GLOSS |
| 正印 | 学识、庇护、长辈、贵人 | SAFE_SEMANTIC_GLOSS |

每个十神均含：结构定义、传统主题、safe 白话主题、context_required 主题、prohibited 直接推断、allowed_template、boundary_template、来源、证据等级、consensus、interpretation_gate（见 `ten_god_semantics.json`）。

## 4. 十六问正式回答

**Q1 十神 10 类是否都有稳定传统基础语义**：是。结构定义确定（L1），传统主题关联稳定（L1 共识）；但"主题关联"不等于"个人结论"。

**Q2 哪些十神含义可以直接白话展示**：全部 10 类十神的**主题关联层**（SAFE_SEMANTIC_GLOSS），如"传统子平常从约束、规则、压力、竞争等主题观察七杀"。不含任何个人化判断。

**Q3 哪些含义必须结合旺衰**：十神的表现方向（七杀是压力还是执行力、财是否可任、印是否过重等）、组合解释（食神制杀、伤官佩印、官印相生等）全部 CONTEXT_REQUIRED。

**Q4 "两个七杀"能不能直接解释**：不能。只能陈述"命盘中有两个可见七杀关系"（FACT_ONLY）；不得输出"七杀很重/压力巨大/事业心极强"。

**Q5 十神数量能不能单独作为判断依据**：不能。`COUNT_ONLY_IS_NOT_INTERPRETATION` 成立——数量只是事实计数，解释需结合透干/藏干、得令、得地、旺衰、制化。

**Q6 天干透出和地支藏干能否同等解释**：不能。传统"天干为显、地支为藏"（滴天髓类象：天干如浮云、地支如深根），层级不同；但透干强弱结论依赖根气与旺衰，当前只能显示"存在关系"（天干见/仅藏干见），不解释强弱，不开发透干评分。

**Q7 柱位是否存在可冻结的基础语义**：不存在可冻结的静态断言。年祖上/月父母/日自身/时子女的六亲宫位分配在古典与现代大体一致（渊海子平六亲总论），属"传统观察维度"；"早年/晚年/事业宫"等扩展表述有流派差异 → `TRADITION_POLICY_REQUIRED`。

**Q8 日主概念能否正式冻结**：能（PROPOSE_SAFE_GLOSS）。日主/日元/日干为语义等价术语（SEMANTIC_EQUIVALENT），传统以日干为主、为分析中心（渊海子平·论日为主）。白话定义："日主（日干）是日柱的天干，在子平八字分析中作为本人和十神关系计算的中心参照。"不得延伸为"乙木人性格怎样"。

**Q9 月令为什么是下一层关键**：月令（月支+节气）为"提纲"（渊海子平），在旺衰与格局中地位最高；得令是旺衰第一输入。Foundation 已有月支，但月令的解释消费（得令/失令、用事）未冻结。

**Q10 得令是否可以简单机器化**：不能简单二元化。"得令≠身旺"为公认反例（旺而不强、虚浮无根）；月令不是唯一决定性输入（渊海子平：生月即不值令，而年时如值禄旺，岂便为衰）。`TRADITION_POLICY_REQUIRED`。

**Q11 通根是否可以机器化**：存在性可以——`STEM_ROOT_PRESENT`（某天干在四支藏干成员集合中出现）可确定性检测。但"通根=传统意义得地"及强弱分级（本气/中气/余气根）涉及未冻结的藏干顺序与权重政策 → 强弱解释阻断。

**Q12 通根强弱是否涉及藏干政策**：涉及。本气/中气/余气分级依赖藏干顺序与权重，而 foundation 已冻结顺序无语义（NONE_V0_2）、本中余气 `TRADITION_POLICY_REQUIRED`、权重 `OUT_OF_SCOPE` → 阻断。

**Q13 旺衰是否存在统一算法**：不存在。传统"三得判断法"（定性）与现代"量化计分法"（百分制）结果可不同（REAL_INTERPRETATION_CONFLICT）；禁止 60分/40分/百分比自造模型。

**Q14 下一阶段是否应研究旺衰**：是，但作为独立依赖层，且需先解决月令与藏干政策。最小下一层依赖：月令 → 旺衰（日主状态）→ 通根（藏干政策）。

**Q15 哪些常见命理断语当前必须禁止**：见 `prohibited_inferences.json`——"你天生/注定/一生/必定/命中注定/婚姻不顺/必有横财/晚年富贵/事业一定成功/容易离婚/克父克母/子女不孝"及"七杀多=脾气暴躁"等 8 类结构性反例，全部 `PROHIBITED_DIRECT_INFERENCE`。

**Q16 第一版产品到底能给用户解释到什么程度**：
- 可显示：FACT_ONLY（干支、十神关系、藏干成员、透出/仅藏干存在关系、数量计数）+ SAFE_SEMANTIC_GLOSS（十神传统主题关联）+ 日主定义。
- 可提示：CONTEXT_REQUIRED（说明"这需要结合更多条件才能进一步讨论"）。
- 必须阻断：任何个人化性格/事业/财运/婚姻/健康/吉凶结论，旺衰/喜用/格局/大运流年输出。

## 5. 状态分类统计（真实统计，不硬凑）

| 状态 | 数量 | 说明 |
|---|---|---|
| PROPOSE_SAFE_GLOSS | 11 | 10 十神主题关联层 + 日主定义 |
| CONTEXT_REQUIRED | 10 | 每十神的 context_required_topics 类（表现方向/组合解释） |
| TRADITION_POLICY_REQUIRED | 4 | 柱位语义、透干强弱、得令二元化、通根强弱 |
| PROHIBITED_DIRECT_INFERENCE | 12+ | 禁语短语 12 条 + 8 类结构性反例（重叠计数归并后以文件为准） |
| REQUIRES_MORE_EVIDENCE | 0 | 本轮无此状态项 |
| OUT_OF_SCOPE | 1 | 旺衰评分/喜用神/大运等自造模型类 |

注：状态数按"独立决策项"计，交叉引用不重复计数；具体以各 JSON 文件字段为准。

## 6. 真正流派冲突（REAL_INTERPRETATION_CONFLICT）

1. 十神数量的解释意义（党众 vs 需制化）
2. 旺衰判断口径（三得法 vs 量化计分法）
3. 透干与藏干的强弱解释
4. 得令/失令二元化

这四项冲突导致解释层不能直接机器化个人结论，是 `CONTEXT_REQUIRED` 与 `PROHIBITED` 的根据。

## 7. 停止条件检查

- 十神基础语义已充分交叉验证 → 停止扩展十神
- 未进入完整旺衰算法/格局/喜用神/大运/人生预测（仅研究依赖关系）
- 低质量来源仅作反例登记，未作证据
- 本轮未"顺便"搜索全部八字体系

## 8. 安全与边界声明

- 未使用用户真实命盘作研究真值；仅用匿名结构（DAY_MASTER_YI / TWO_VISIBLE_QISHA 等）测试解释边界
- 未修改 src/**、data/frozen/**、public/**、Foundation runtime、Bazi 页面、六爻
- 未开发 runtime、未 commit

## 9. 建议

- 建议 Phase 2.5B 正式冻结解释协议（SAFE_GLOSS 层 + gate 系统 + 禁语清单）
- 不建议 CX 现在开发真正命理解读页面（CONTEXT_REQUIRED 以上输出仍阻断；旺衰/月令/藏干政策未冻结）
- 下一研究层：月令专项 → 旺衰依赖 → 通根（藏干政策解冻后）

## 10. Phase 2.5A.1 SAFE_GLOSS 证据硬化 + 隐私修复记录

### 10.1 隐私修复

- 已删除 `validate_bazi_interpretation_research_v01.py` 中用户真实出生资料字面量（原 REAL_DATA 列表）。
- 全目录扫描确认：用户具体生日值、紧凑日期形态、原完整四柱组合、原出生地点、原出生时刻（含时分的日期形态）均 **0 命中**；单干支通用词亦为 0。本报告不重复这些具体值。
- validator 改为**形态检测**（YYYY-MM-DD+HH:mm 模式、8 位数字、独立 HH:mm、四柱交替形态、真实资料字段名标记），不写任何具体用户值。

### 10.2 SAFE_GLOSS 逐条证据链

新增 `safe_gloss_evidence_v0.1.json`，11 项（10 十神 + 日主）逐条含 `source_evidence[]`（source_id/title/section/url/retrieved_date/short_excerpt/supports_exactly/limitations）、`evidence_strength`、`paraphrase_class`、`freeze_recommendation`。原文摘录全部来自《渊海子平》（维基文库，2026-08-12 检索）。

### 10.3 十四问新增回答

**Q1 原 11 条 SAFE_GLOSS 最终保留多少**：10 条（比肩/劫财/食神/伤官/正财/偏财/七杀/正官/正印/日主）可冻结；偏印降级。

**Q2 哪些现代词被删除或降级**：比肩（自我意识/独立/合作）、劫财（资源共享/行动力）、食神（才华/表达）、伤官（创造力/个性表达/叛逆）、正财（稳定财富/勤劳务实）、偏财（投资机遇/社交人脉）、七杀（规则/责任/权威）、正官（规则/纪律/上级）、正印（贵人）全部删除或降级；偏印整体（特殊学识/灵感/深度思考）降级 REQUIRES_MORE_EVIDENCE。

**Q3 DIRECT_TEXT 数量**：1（日主——"取日干为主"原文直译）。

**Q4 CONSERVATIVE_PARAPHRASE 数量**：9（比肩/劫财/食神/伤官/正财/偏财/七杀/正官/正印，均以渊海子平原文保守转译）。

**Q5 MODERN_EXTENSION 数量**：1（偏印——倒食为组合概念，特殊学识/灵感等为现代扩展，降级）。

**Q6 是否仍有任何无逐条证据的 SAFE_GLOSS**：无。9 个 SAFE 十神全部在 evidence 文件有逐条记录（validator 第 25 项确认）。

**Q7 用户真实资料是否已彻底删除**：是。validator 无字面量，形态检测 0 命中；全目录扫描具体值全部 0。

**Q8 是否满足 Phase 2.5B 冻结条件**：SAFE_GLOSS 层满足（10 条冻结候选 + 逐条证据链 + gate/禁语/20 测试齐备）；CONTEXT_REQUIRED 以上仍阻断。

### 10.4 重新统计（Phase 2.5A.1）

| 状态 | 数量 | 说明 |
|---|---|---|
| PROPOSE_SAFE_GLOSS_FREEZE | 10 | 9 十神（保守版）+ 日主（DIRECT） |
| CONTEXT_REQUIRED | 10 | 每十神 context_required_topics 类 |
| REQUIRES_MORE_EVIDENCE | 1 | 偏印 SAFE_GLOSS（降级） |
| TRADITION_POLICY_REQUIRED | 4 | 柱位/透干强弱/得令/通根强弱 |
| PROHIBITED_DIRECT_INFERENCE | 12+8 | 禁语短语 + 结构性反例 |

注：本统计以文件真实字段为准（validator 未将其硬编码为 PASS 条件）；质量优先，不强求 11 条全冻结。

## 11. Phase 2.5A.2 五层一致性收口记录

### 11.1 交叉证据

按任务要求为 CONSERVATIVE_MODERN_PARAPHRASE 项补第二个独立已登记来源（优先现有来源；不搜索算命网站/自媒体）。结论：

- **双 L1 交叉（渊海子平 + 子平真诠）冻结 7 条**：正财（渊海"吾妻之财" + 真诠"财帛妻妾"）、正官（渊海"贵气之物" + 真诠"分所当尊"）、七杀（渊海"要制伏" + 真诠"煞以攻身"）、正印（渊海"生我者即印绶" + 真诠"印绶喜其生身"）、伤官（渊海"多才艺傲物气高" + 真诠"实为秀气"）、食神（渊海"财厚食丰" + 真诠"生正财所以喜之"）、劫财（渊海"主破耗" + 真诠"禄即是劫"）。
- **单来源降级 2 条**：比肩（六亲"比肩为兄弟姐妹"——渊海单源，第二来源未在现有登记来源中直接取得）、偏财（"众人之财"——渊海单源）→ `REQUIRES_MORE_EVIDENCE`，不硬凑。
- 日主：DIRECT_TEXT_MEANING（渊海"取日干为主"）保持冻结。
- 偏印：保持 `REQUIRES_MORE_EVIDENCE`。

### 11.2 五层一致性

safe_gloss_evidence → ten_god_semantics → interpretation_gates → prohibited_inferences → report 五层同步：

- ten_god_semantics：SAFE gate 十神更新为 7 个（劫财/食神/伤官/正财/七杀/正官/正印）；比肩、偏财降级 `REQUIRES_MORE_EVIDENCE`。
- interpretation_gates：20 个 case 全部增加 `allowed_gate`（FACT_ONLY/SAFE_SEMANTIC_GLOSS/CONTEXT_REQUIRED）；allowed 与最新 SAFE_GLOSS 精确一致；降级术语（比肩/偏财/偏印）仅 FACT_ONLY；removed 现代词 0 残留（"享受"为渊海"优游自足"保留保守词，非 removed 词）。
- prohibited_inferences：偏印 why_blocked 已去除"特殊学识/灵感/深度思考"旧表述。
- report：本节同步记录。
- validator：14/14 PASS（JSON、十神完整性、12 项证据/一致性/隐私/预测检查、五层一致性）。

### 11.3 Phase 2.5A.2 最终统计

| 状态 | 数量 | 说明 |
|---|---|---|
| PROPOSE_SAFE_GLOSS_FREEZE | **8** | 日主（DIRECT）+ 7 十神（双 L1 交叉 CONSERVATIVE） |
| REQUIRES_MORE_EVIDENCE | **3** | 比肩、偏财、偏印（SAFE_GLOSS 均不冻结） |
| CONTEXT_REQUIRED | 10 | 每十神 context_required_topics 类 |
| TRADITION_POLICY_REQUIRED | 4 | 柱位/透干强弱/得令/通根强弱 |
| PROHIBITED_DIRECT_INFERENCE | 12+8 | 禁语短语 + 结构性反例 |

注：冻结项从 2.5A.1 的 10 条降至 8 条（比肩/偏财因单来源降级），质量优先；本统计以文件真实字段为准。
