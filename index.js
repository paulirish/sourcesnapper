const acorn = require('acorn');
const walk = require('acorn-walk');

const fs = require('fs');
const jsSource = fs.readFileSync('./test/mol-adverts.pretty.js');

console.log('\n\n\n\n\n');
console.log('walking');

const ast = acorn.parse(jsSource);
const total = ast.end - ast.start;
// console.log(JSON.stringify(ast, null, 2));

// fs.writeFileSync('simple.ast.json', JSON.stringify(ast, null, 2));

const moduleDictCandidates = new Set();
const moduleFuncs = new Set();

walk.ancestor(ast, {
  FunctionExpression(node, ancestors) {
    const isWithinAnObjLiteral =
      ancestors.slice(-1)[0].type === 'FunctionExpression' &&
      ancestors.slice(-2)[0].type === 'Property' &&
      ancestors.slice(-3)[0].type === 'ObjectExpression';

    if (isWithinAnObjLiteral) moduleDictCandidates.add(ancestors.slice(-3)[0]);

    const isInArrayWithinAnObjLiteral =
      ancestors.slice(-1)[0].type === 'FunctionExpression' &&
      ancestors.slice(-2)[0].type === 'ArrayExpression' &&
      ancestors.slice(-3)[0].type === 'Property' &&
      ancestors.slice(-4)[0].type === 'ObjectExpression';

    if (isInArrayWithinAnObjLiteral) moduleDictCandidates.add(ancestors.slice(-4)[0]);
  },
});


const moduleDicts = Array.from(moduleDictCandidates).filter(dict => {
  const isBig = dict.end - dict.start > 30 * 1024;
  return isBig;
});

moduleDicts.forEach(moduleDict => {
  const isBig = moduleDict.end - moduleDict.start > 30 * 1024;
  if (!isBig) return;

  // const walk.findNodeAt(moduleDict, null, null, 'FunctionExpression')
  console.log('found a big obj literal of functions. here are his children');
  moduleDict.properties.forEach(node => {
    if (node.type === 'Property') node = node.value;
    if (node.type === 'ArrayExpression')
      node = node.elements.find(n => n.type === 'FunctionExpression');

    const size = node.end - node.start;
    console.log(
      ' - ',
      node.type,
      `${(size / 1024).toFixed(1)} kB`.padStart(8),
      `${((size * 100) / total).toFixed(2)}%`.padStart(8)
    );
    moduleFuncs.add(node);
  });
});


const sorted = [...moduleDicts, ...moduleFuncs].sort((a, b) => a.start - b.start);


const tree = makeEntry(ast);
const treeNodes = [tree];

sorted.forEach(node => {

  const treeEntry = makeEntry(node);
  const parentToBe = findLast(treeNodes, treeNode => treeNode.start < node.start && treeNode.end > node.end);
  if (parentToBe) {
    parentToBe.children = parentToBe.children || [];
    parentToBe.children.push(treeEntry);
    treeNodes.push(treeEntry);
  } else {
    throw new Error('omg');
  }
});

fs.writeFileSync('treendoes.json', JSON.stringify(tree, null, 2), 'utf8');




function findLast(arr, pred) {
  arr.reverse();
  const ret = arr.find(pred);
  arr.reverse();
  return ret;
}



function makeEntry(node) {
  const start = node.start;
  const end = node.end;
  const id = `${node.type}   ·   ${start.toLocaleString()} - ${end.toLocaleString()}`;
  const size = end - start;
  return {id, start, end, size};
}