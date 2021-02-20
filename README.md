# react-fiber

> https://react.iamkasong.com
> https://pomb.us/build-your-own-react/


render阶段 (schedue, Diff算法在 reconcileChildren 阶段)
commit阶段 (开始真实 dom 更新操作)
Hooks
Concurrent Mode

React15架构可以分为两层：

Reconciler（协调器）—— 负责找出变化的组件
Renderer（渲染器）—— 负责将变化的组件渲染到页面上


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