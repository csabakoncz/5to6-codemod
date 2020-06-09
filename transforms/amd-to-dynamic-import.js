/**
 * Require calls are converted to dynamic imports that work with Webpack 4.
 * It is assumed  that the required modules use default exports.
 *
 Input:

require(['A','B','C'], function(a,b,c) {
  //callback body
});

Output:
Promise.all([import('A'), import('B'), import('C')]).then(
    function ([{default: a}, {default: b}, {default: c}]) {
    //callback body
});

*/

var util = require('../utils/main');

module.exports = function (file, api, options) {
    var j = api.jscodeshift;
    var root = j(file.source);

    root
        .find(j.CallExpression, { callee: { name: 'require' } }) // find require() function calls
        .forEach(function (p) {

            if (p.value.arguments.length != 2) {
                return
            }

            let moduleNames = p.value.arguments[0]
            let callback = p.value.arguments[1]

            let thenParams = [
                j.arrayPattern(
                    callback.params.map(p =>
                        j.objectPattern(
                            [
                                j.property(
                                    'init',
                                    j.identifier('default'),
                                    j.identifier(p.name)
                                )
                            ]
                        )
                    )
                )
            ]

            let ast = j.expressionStatement(
                j.callExpression(
                    j.memberExpression(
                        j.callExpression(
                            j.memberExpression(
                                j.identifier('Promise'),
                                j.identifier('all')
                            ),
                            [
                                j.arrayExpression(
                                    moduleNames.elements.map(e =>
                                        j.callExpression(j.identifier('import'), [e])
                                    )
                                )
                            ]
                        ),
                        j.identifier('then')
                    ),
                    [j.functionExpression(null, thenParams, callback.body)]
                )
            )

            // p.parentPath.parentPath.value.push(ast)
            return j(p.parent).replaceWith(ast);
        })

    return root.toSource(util.getRecastConfig(options));
};
