export const PRODUCT_MODULES = [
  {
    id: "bazi",
    href: "/bazi/",
    title: "生辰八字",
    description: "输入出生资料与正式时区，生成确定性的基础四柱。",
    status: "基础四柱排盘可用",
    action: "填写出生资料",
    tone: "available",
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
