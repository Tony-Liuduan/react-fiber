# react-fiber

> https://react.iamkasong.com
> https://pomb.us/build-your-own-react/


render阶段 (schedue, Diff算法在 reconcileChildren 阶段)
commit阶段 (开始真实 dom 更新操作)


React15架构可以分为两层：

Reconciler（协调器）—— 负责找出变化的组件, 递归处理虚拟DOM
Renderer（渲染器）—— 负责将变化的组件渲染到页面上
Reconciler 和 Renderer是交替工作的


React16架构可以分为三层：

Scheduler（调度器）—— 调度任务的优先级, 高优任务优先进入Reconciler, 可以理解为 requestIdleCallback-polyfill - render 阶段
Reconciler（协调器）—— 负责找出变化的组件, 从递归变为可以中断的循环过程。每次循环都会调用shouldYield判断当前是否有剩余时间 - render 阶段
Renderer（渲染器）—— 负责将变化的组件渲染到页面上 commit 阶段

Reconciler与Renderer不再是交替工作, 分离工作, Reconciler 负责打标记
当Scheduler将任务交给Reconciler后，Reconciler会为变化的虚拟DOM打上代表增/删/更新的标记
整个Scheduler与Reconciler的工作都在内存中进行。只有当所有组件都完成Reconciler的工作，才会统一交给Renderer


react15
![react15](https://react.iamkasong.com/img/v15.png)
react16
![react16](https://react.iamkasong.com/img/process.png)


小结: 
从React15到React16，协调器（Reconciler）重构的一大目的是：将老的同步更新的架构变为异步可中断更新
### Diff
三原则:
1. 统计比较
2. type 不同则对子递归删除
3. key 相同可以复用, key 不同则删除


单节点:
    先判断 key 再判断 type
多节点:
    结论: 考虑性能，我们要尽量减少将节点从后面移动到前面的操作。
    移动参照物是：最后一个可复用的节点在oldFiber中的位置索引（用变量lastPlacedIndex表示, 初始值 0）。
    2 轮遍历
    第一轮遍历接受后, 将 oldFiber 中剩余的按 key 对象 obj 存储, value 值为对应 fiber 和 key 在所在 oldFiber 链表中的索引值
    第二轮遍历 newChildren 数组列表, 按 key 在 obj 中查其所在 oldFiber 中的索引 index, 和 lastPlacedIndex 比对
    index >= lastPlacedIndex dom 可复用,不移动位置
    index <  lastPlacedIndex dom 可复用,向后移动位置
    未找到 key, 不可复用, 需要新建
    第二轮遍历, 新节点遍历完后再遍历老节点, 判断是否存在没有遍历到的老节点, 编辑删除




### 代数效应
Fiber并不是计算机术语中的新名词，他的中文翻译叫做纤程，与进程（Process）、线程（Thread）、协程（Coroutine）同为程序执行过程。

在很多文章中将纤程理解为协程的一种实现。在JS中，协程的实现便是Generator。

所以，我们可以将纤程(Fiber)、协程(Generator)理解为代数效应思想在JS中的体现


### fiber
虚拟DOM在React中有个正式的称呼——Fiber
1. 作为架构来说，之前React15的Reconciler采用递归的方式执行，数据保存在递归调用栈中，所以被称为stack Reconciler。React16的Reconciler基于Fiber节点实现，被称为Fiber Reconciler。
2. 作为静态的数据结构来说，每个Fiber节点对应一个React element，保存了该组件的类型（函数组件/类组件/原生组件...）、对应的DOM节点等信息。
3. 作为动态的工作单元来说，每个Fiber节点保存了本次更新中该组件改变的状态、要执行的工作（需要被删除/被插入页面中/被更新...）。

```js
function FiberNode(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
) {
  // 作为静态数据结构的属性
  this.tag = tag;   // Fiber对应组件的类型 Function/Class/Host...
  this.key = key; // key属性
  this.elementType = null; // 大部分情况同type，某些情况不同，比如FunctionComponent使用React.memo包裹
  this.type = null; // 对于 FunctionComponent，指函数本身，对于ClassComponent，指class，对于HostComponent，指DOM节点tagName
  this.stateNode = null; // Fiber对应的真实DOM节点

  // 用于连接其他Fiber节点形成Fiber树
  this.return = null;   // 指向父级Fiber节点
  this.child = null;    // 指向子Fiber节点
  this.sibling = null;  // 指向右边第一个兄弟Fiber节点
  this.index = 0;

  this.ref = null;

  // 作为动态的工作单元的属性
  this.pendingProps = pendingProps;
  this.memoizedProps = null;
  this.updateQueue = null;
  this.memoizedState = null;
  this.dependencies = null;

  this.mode = mode;

  this.effectTag = NoEffect; // 保存本次更新会造成的DOM操作
  this.nextEffect = null;

  this.firstEffect = null;
  this.lastEffect = null;

  // 调度优先级相关
  this.lanes = NoLanes;
  this.childLanes = NoLanes;

  // 指向该fiber在另一次更新时对应的fiber
  this.alternate = null;
}
```

双缓存Fiber树:
currentFiber树: 当前屏幕上显示内容对应的Fiber树
workInProgressFiber树: 正在内存中构建的Fiber树

```js
currentFiber.alternate === workInProgressFiber;
workInProgressFiber.alternate === currentFiber;
```

当workInProgress Fiber树构建完成交给Renderer渲染在页面上后，应用根节点的current指针指向workInProgress Fiber树，
此时workInProgress Fiber树就变为current Fiber树。