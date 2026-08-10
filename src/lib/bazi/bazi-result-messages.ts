export interface BaziBlockingMessage {
  title: string;
  detail: string;
}

const BLOCKING_MESSAGES: Record<string, BaziBlockingMessage> = {
  LUNAR_INPUT_NOT_SUPPORTED_V0_1: { title: "暂不支持农历输入", detail: "当前版本仅支持公历出生日期。" },
  INVALID_CIVIL_DATE: { title: "出生日期无效", detail: "请核对公历日期后重新提交。" },
  DATE_OUT_OF_SUPPORTED_RANGE: { title: "出生日期超出支持范围", detail: "当前基础排盘支持 1970—2100 年。" },
  DATE_OUT_OF_ALGORITHM_RANGE: { title: "出生日期超出算法范围", detail: "当前资料无法在已冻结算法范围内排盘。" },
  FUTURE_BIRTH_DATE_NOT_ALLOWED: { title: "出生日期不能晚于当前日期", detail: "请核对出生日期。" },
  LOCATION_REQUIRED: { title: "请选择出生地区", detail: "请选择中国大陆，或填写其他地区名称并选择 IANA 时区。" },
  TIMEZONE_REQUIRED: { title: "请选择正式时区", detail: "其他地区必须从已验证的 IANA 时区目录中显式选择。" },
  LOCATION_TIMEZONE_MISMATCH: { title: "地点与时区不一致", detail: "请重新选择地点模式和正式时区。" },
  NONEXISTENT_LOCAL_TIME: { title: "这个当地时间实际不存在", detail: "所选地区在该日期发生时制调整，这个当地时间实际不存在。请核对出生时间。" },
  AMBIGUOUS_LOCAL_TIME: { title: "这个当地时间出现了两次", detail: "请选择实际发生的较早一次或较晚一次。" },
  SOLAR_TERM_DATA_UNAVAILABLE: { title: "节气数据不可用", detail: "当前日期缺少完成确定性排盘所需的冻结节气数据。" },
  SOLAR_TERM_SAME_MINUTE_AMBIGUOUS: { title: "节气换界分钟无法唯一判定", detail: "出生时间所在这一分钟内发生了节气换界，当前分钟精度无法唯一确定四柱。如有更精确出生记录，可后续使用支持秒级输入的版本重新核准。" },
  SOLAR_TERM_TIME_REQUIRED: { title: "节气边界需要出生时间", detail: "该日期无法在未知时辰条件下唯一确定年柱或月柱。" },
  DAY_ALGORITHM_CROSSCHECK_FAILED: { title: "日柱交叉校验未通过", detail: "确定性日柱算法未通过内部交叉校验，本次不输出四柱。" },
};

export function getBaziBlockingMessage(code: string | null): BaziBlockingMessage {
  if (code && BLOCKING_MESSAGES[code]) return BLOCKING_MESSAGES[code];
  return { title: "当前资料无法完成确定性排盘", detail: "请核对输入后重新提交。" };
}

export const BOUNDARY_SENSITIVE_MESSAGE =
  "出生时间距离节气换界非常近，四柱对时间精度较敏感，请优先核对原始出生记录。";
