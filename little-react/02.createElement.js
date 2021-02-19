// const element = (
//     <div id="foo">
//         <a>bar</a>
//         <b />
//     </div>
// )
// const container = document.getElementById("root")
// ReactDOM.render(element, container)







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
function render(element, container) {
    // 创建元素
    const dom =
        element.type == "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(element.type)

    // 将元素 prop 分配给节点
    const isProperty = key => key !== "children"
    Object.keys(element.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] = element.props[name]
        })

    // 递归地为每个孩子做同样的事情
    // FIXME: 存在问题, 一旦开始渲染，就不会停止，直到我们渲染了完整的元素树。如果元素树很大，则可能会阻塞主线程太长时间
    element.props.children.forEach(child =>
        render(child, dom)
    )

    container.appendChild(dom)
}

const Didact = {
    createElement,
    createTextElement,
    render,
}
/** @jsx Didact.createElement */  // 告诉 babel 使用这个方法解析 jsx
const element = Didact.createElement(
    "div",
    { id: "foo" },
    Didact.createElement("a", null, "bar"),
    Didact.createElement("b")
)
console.log(JSON.stringify(element))
const container = document.getElementById("root")
Didact.render(element, container)