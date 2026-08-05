export const PRODUCT_MODULES = [
  {
    id: "bazi",
    href: "/bazi/",
    title: "生辰八字",
    description: "输入出生资料，建立四柱命盘与基础命理分析。",
    status: "排盘规则准备中",
    action: "填写出生资料",
    tone: "warning",
  },
  {
    id: "liuyao",
    href: "/liuyao/",
    title: "六爻问事",
    description: "围绕一件具体事情起卦，查看卦象、动爻与原文证据。",
    status: "基础卦象功能可用",
    action: "开始问事",
    tone: "available",
  },
] as const;
