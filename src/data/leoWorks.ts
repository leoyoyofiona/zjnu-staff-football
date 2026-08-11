export interface LeoWork {
  title: string
  kicker: string
  description: string
  tags: string[]
  accent: string
  href?: string
}

const github = (repo: string) => `https://github.com/leoyoyofiona/${repo}`

export const LEO_WORKS: LeoWork[] = [
  {
    title: '世界杯',
    kicker: 'WORLD CUP',
    description: '把赛程、对阵与预测做成一张随时可看的比赛地图。',
    tags: ['体育', '预测'],
    accent: '#35d0ba',
    href: github('worldcup-prediction'),
  },
  {
    title: '足彩',
    kicker: 'FOOTBALL LOTTERY',
    description: '围绕足球赛事做快速浏览与选号参考。',
    tags: ['数据', '足球'],
    accent: '#f3a63a',
    href: github('leo-football-lottery'),
  },
  {
    title: '大乐透',
    kicker: 'SUPER LOTTO',
    description: '用趋势和历史数据整理大乐透的观察面板。',
    tags: ['趋势', '分析'],
    accent: '#ff6f91',
    href: github('super-lotto-trend-model'),
  },
  {
    title: '福彩',
    kicker: 'WELFARE LOTTERY',
    description: '轻量查看福利彩票数据与号码走势。',
    tags: ['号码', '趋势'],
    accent: '#9f8cff',
    href: github('leo-welfare-lottery'),
  },
  {
    title: '周星弛',
    kicker: 'STEPHEN CHOW ARCHIVE',
    description: '一份面向影迷的作品、人物与时间线档案。',
    tags: ['文化', '档案'],
    accent: '#f4c95d',
    href: github('stephen-chow-works-mainland'),
  },
  {
    title: '抓小红书',
    kicker: 'XHS FAVORITES',
    description: '把收藏内容抓取、整理，变成自己的可检索资料库。',
    tags: ['效率', '收藏'],
    accent: '#ff5c61',
    href: github('xiaohongshu-favorites'),
  },
  {
    title: '同声传译',
    kicker: 'LIVE INTERPRETATION',
    description: '面向多语场景的实时翻译与沟通辅助工具。',
    tags: ['翻译', '语言'],
    accent: '#56a8ff',
    href: github('ZH-EN-TH-translate'),
  },
  {
    title: '打字三下空格翻译',
    kicker: 'TRIPLE SPACE',
    description: '用一个熟悉的键盘动作，把文字转换成即时翻译。',
    tags: ['输入', '翻译'],
    accent: '#b993ff',
    href: github('triple-space-translator'),
  },
  {
    title: 'macOS快捷助手',
    kicker: 'MACOS SHORTCUTS',
    description: '按住一个键，快速看到当前 macOS 应用的快捷键。',
    tags: ['macOS', '效率'],
    accent: '#8bd450',
    href: github('LEO-MACOS-Shortcut-Assistant'),
  },
  {
    title: 'yoyo学习',
    kicker: 'YOYO LEARNING',
    description: '把学习资料、任务和复习节奏放进一个轻量空间。',
    tags: ['学习', '工作流'],
    accent: '#ff9d66',
    href: github('yoyo-learning-boost'),
  },
  {
    title: '足彩分析',
    kicker: 'MATCH ANALYTICS',
    description: '从更细的赛事视角观察足彩数据和赛果线索。',
    tags: ['足球', '分析'],
    accent: '#45d4e8',
    href: github('leo-football-lottery'),
  },
  {
    title: '高考志愿填报',
    kicker: 'ZHiyuan COMPASS',
    description: '把志愿选择整理成更容易比较和决策的路线图。',
    tags: ['教育', '决策'],
    accent: '#68bdff',
    href: github('leo-zhiyuan-compass'),
  },
  {
    title: '今天你笑了吗？',
    kicker: 'DAILY JOY',
    description: '给忙碌的一天留一个轻松入口，收集一点好心情。',
    tags: ['生活', '轻松'],
    accent: '#ffd166',
  },
  {
    title: '浙师大约球',
    kicker: 'ZJNU FOOTBALL',
    description: '从微信群接龙到分队、赛后统计和年度榜单。',
    tags: ['本项目', '体育'],
    accent: '#39d98a',
    href: github('zjnu-staff-football'),
  },
  {
    title: '自动模仿手打字',
    kicker: 'AUTOTYPE',
    description: '让机器输入更像真实的人类打字节奏。',
    tags: ['自动化', '输入'],
    accent: '#f598ff',
    href: github('autotype'),
  },
  {
    title: 'notype',
    kicker: 'VOICE INPUT',
    description: '原生 macOS 语音输入、实时听写与双语整理。',
    tags: ['macOS', '语音'],
    accent: '#75e2c2',
    href: github('NoType'),
  },
  {
    title: 'workbuddy学习',
    kicker: 'WORKBUDDY',
    description: '一份面向中文用户的 WorkBuddy 学习与上手指南。',
    tags: ['指南', '学习'],
    accent: '#ff7c7c',
    href: github('workbuddy-guide'),
  },
]
