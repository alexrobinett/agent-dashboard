/**
 * @fileoverview Disallow state setter calls inside useEffect callbacks.
 */

function isUseEffectCall(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee &&
    ((node.callee.type === 'Identifier' && node.callee.name === 'useEffect') ||
      (node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property?.type === 'Identifier' &&
        node.callee.property.name === 'useEffect'))
  )
}

function getCalleeName(callee) {
  if (!callee) return null

  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object?.type === 'ThisExpression' &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === 'setState'
  ) {
    return 'this.setState'
  }

  return null
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow setState calls inside useEffect callbacks',
    },
    schema: [],
    messages: {
      noSetStateInUseEffect:
        'Avoid calling {{name}} inside useEffect. This can cause re-render loops and unnecessary effect executions.',
    },
  },

  create(context) {
    const useEffectCallbackStack = []

    function enterFunction(fnNode) {
      const ancestors = context.sourceCode.getAncestors(fnNode)
      const parent = ancestors[ancestors.length - 1]

      if (
        parent &&
        parent.type === 'CallExpression' &&
        isUseEffectCall(parent) &&
        (parent.arguments[0] === fnNode ||
          (parent.arguments[0]?.type === 'ChainExpression' && parent.arguments[0].expression === fnNode))
      ) {
        useEffectCallbackStack.push(fnNode)
      }
    }

    function exitFunction(fnNode) {
      const top = useEffectCallbackStack[useEffectCallbackStack.length - 1]
      if (top === fnNode) {
        useEffectCallbackStack.pop()
      }
    }

    return {
      ArrowFunctionExpression: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,

      CallExpression(node) {
        if (useEffectCallbackStack.length === 0) return

        const name = getCalleeName(node.callee)
        if (!name) return

        if (name === 'this.setState' || /^set[A-Z]/.test(name)) {
          context.report({
            node,
            messageId: 'noSetStateInUseEffect',
            data: { name },
          })
        }
      },
    }
  },
}
