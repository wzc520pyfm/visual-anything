import type { Mark } from "./types.js";

export interface Sample {
  id: string;
  title: string;
  description: string;
  intentText?: string;
  text: string;
  expectedMark: Mark;
}

export const SAMPLES: Sample[] = [
  {
    id: "trend",
    title: "区域月销售额",
    description: "三个区域、半年的销售额。适合看走势，也适合在图例里关掉某一条线。",
    intentText: "看各区域销售额趋势",
    expectedMark: "line",
    text: `月份,区域,销售额
2024-01,华东,186
2024-01,华北,142
2024-01,华南,121
2024-02,华东,174
2024-02,华北,151
2024-02,华南,133
2024-03,华东,198
2024-03,华北,147
2024-03,华南,129
2024-04,华东,205
2024-04,华北,162
2024-04,华南,141
2024-05,华东,192
2024-05,华北,158
2024-05,华南,136
2024-06,华东,214
2024-06,华北,171
2024-06,华南,149`,
  },
  {
    id: "category",
    title: "品类销售额",
    description: "六个品类的销售额对比。柱子从零开始，避免把差距放大。",
    expectedMark: "bar",
    text: `品类,销售额
咖啡豆,128
手冲器具,86
茶叶,103
烘焙,74
杯壶,91
礼盒,67`,
  },
  {
    id: "scatter",
    title: "投放与成交",
    description: "每家门店一周的广告花费和成交额。两轴都是数值，只看是否同向变化。",
    expectedMark: "scatter",
    text: `广告花费,成交额
12,46
18,52
15,49
28,81
22,70
35,96
9,33
41,110
26,77
19,61`,
  },
  {
    id: "share",
    title: "渠道订单占比",
    description: "四个渠道的订单量。提问里写了占比，所以优先用饼图。",
    intentText: "看各渠道订单占比",
    expectedMark: "pie",
    text: `渠道,订单量
小程序,1860
门店,940
外卖,620
企业团购,280`,
  },
  {
    id: "heatmap",
    title: "门店时段客流",
    description: "三家门店在四个时段的客流。颜色越深，人越多。",
    expectedMark: "heatmap",
    text: `时段,门店,客流
上午,南京东路,120
上午,淮海中路,86
上午,徐家汇,102
下午,南京东路,168
下午,淮海中路,143
下午,徐家汇,151
傍晚,南京东路,196
傍晚,淮海中路,172
傍晚,徐家汇,164
夜间,南京东路,88
夜间,淮海中路,74
夜间,徐家汇,69`,
  },
];
