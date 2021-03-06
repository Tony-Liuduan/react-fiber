function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === "object"
                    ? child
                    : createTextElement(child)
            ),
        },
    }
}
function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    }
}

let nextUnitOfWork = null // 下一个工作 fiber 单元
let wipRoot = null // 用于跟踪当前在构建的 root fiber tree
let currentRoot = null  // 用于记录上一次的 root fiber tree
let deletions = null // 用于收集需要删除的 dom 节点 list
let wipFiber = null // 用于记录当前将要准备执行 function component 的 fiber
let hookIndex = null // 用于记录当前将要准备执行 function component 中 hook 的索引


function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
        alternate: currentRoot,
    }
    deletions = []
    nextUnitOfWork = wipRoot
}


function useState(initial) {
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex]

    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    }

    // 当再次执行 function 时候获取最新的 state
    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(hook.state)
    })

    const setState = action => {
        hook.queue.push(action)
        // 执行与render函数中类似的操作, 开始新的渲染
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}


/**
 * @description render 阶段................................
 * 创建 fiber tree, 同时创建节点dom, 标记节点的增删改状态
 */
function workLoop(deadline) {
    // deadline 这个参数可以获取当前空闲时间以及回调是否在超时时间前已经执行的状态。
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        shouldYield = deadline.timeRemaining() < 1
    }

    // 当完成所有工作单元 fiber to dom 的创建, 将所有节点递归附加到根 dom
    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)
function performUnitOfWork(fiber) {
    // 对 function 组件的支持
    const isFunctionComponent = fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    // 若果有子孩子, 子孩子就作为下一个工作单元 nextUnitOfWork
    if (fiber.child) {
        return fiber.child
    }

    let nextFiber = fiber
    while (nextFiber) {
        // 如果没有子孩子, 就查找他的下一兄弟节点作为下一个工作单元 nextUnitOfWork
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        // 如果既没有子孩子, 也没有兄弟节点就往上查找父节点, 继续循环上一步查找
        nextFiber = nextFiber.parent
    }
}
function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []

    // function 组件没有 dom 节点, 不用创建 dom
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}
function updateHostComponent(fiber) {
    if (!fiber.dom) {
        // 创建一个新dom节点
        fiber.dom = createDom(fiber)
    }
    // 为每个孩子创建一个新的 fiber
    reconcileChildren(fiber, fiber.props.children)
}
function createDom(fiber) {
    // 创建元素
    const dom =
        fiber.type == "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(fiber.type)

    // 将元素 prop 分配给节点
    updateDom(dom, {}, fiber.props);

    return dom
}
// 给子孩子创建 fiber
function reconcileChildren(wipFiber, elements) {
    let index = 0
    let prevSibling = null
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child

    while (index < elements.length || oldFiber != null) {
        const element = elements[index]

        // compare oldFiber to element
        let newFiber = null

        // 先比较类型是否一致
        const sameType =
            oldFiber &&
            element &&
            element.type == oldFiber.type

        if (sameType) {
            // update the fiber node 创建新的 fiber node
            newFiber = {
                type: oldFiber.type,
                props: element.props, // update 只替换 props
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE",
            }
        }
        if (element && !sameType) {
            // add this node 创建新的 fiber node
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT",
            }
        }
        if (oldFiber && !sameType) {
            // delete the oldFiber's node
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }

        // 拿到下一个兄弟 fiber node, 循环下去
        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if (index === 0) {
            wipFiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }
}





/**
 * @description 开始 commit 阶段处理................................
 * 挂载 dom, 增删改
 */
function commitRoot() {
    deletions.forEach(commitWork);
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}
function commitWork(fiber) {
    if (!fiber) {
        return
    }
    let domParentFiber = fiber.parent
    // 这里循环查找是因为 function 组件没有 dom, 需要向上查找父节点 dom
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    // 将所有节点递归附加到根 dom, 这里不做打断, 一次全部添加进来
    const domParent = domParentFiber.dom
    if (
        fiber.effectTag === "PLACEMENT" &&
        fiber.dom != null
    ) {
        // 创建新 dom
        domParent.appendChild(fiber.dom)
    } else if (
        fiber.effectTag === "UPDATE" &&
        fiber.dom != null
    ) {
        // 更新 dom
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    } else if (fiber.effectTag === "DELETION") {
        // 删除 dom
        commitDeletion(fiber, domParent)
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}
function commitDeletion(fiber, domParent) {
    // 这里循环查找是因为 function 组件没有 dom, 需要向下查找
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}
function updateDom(dom, prevProps, nextProps) {
    const isEvent = key => key.startsWith("on")
    const isProperty = key => key !== "children" && !isEvent(key) // 特殊处理事件属性
    const isNew = (prev, next) => key => prev[key] !== next[key]
    const isGone = (prev, next) => key => !(key in next)
    // Remove old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key =>
                !(key in nextProps) ||
                isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.removeEventListener(
                eventType,
                prevProps[name]
            )
        })

    // Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.addEventListener(
                eventType,
                nextProps[name]
            )
        })

    // Remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ""
        })

    // Set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })
}

const Didact = {
    createElement,
    createTextElement,
    render,
    useState,
}







/** @jsx Didact.createElement */  // 告诉 babel 使用这个方法解析 jsx
// function Counter() {
//     const [state, setState] = Didact.useState(1)
//     return (
//         <h1 onClick={() => setState(c => c + 1)}>
//             Count: {state}
//         </h1>
//     )
// }
// const element = <Counter />

const element = Didact.createElement(
    function Counter() {
        const [state, setState] = Didact.useState(1)
        return Didact.createElement(
            "h1",
            {
                onClick: () => setState(c => c + 1)
            },
            "Count: ",
            state
        )
    },
    null
)
const container = document.getElementById("root")
Didact.render(element, container)
