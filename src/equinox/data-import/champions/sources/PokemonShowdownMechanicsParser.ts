declare const require: (moduleName: string) => any;

const acorn = require('acorn') as any;

function literal(node: any): unknown {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') {
    const result: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.computed || property.kind !== 'init') continue;
      const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
      if (typeof key !== 'string') continue;
      const propertyValue = literal(property.value);
      if (propertyValue !== undefined) result[key] = propertyValue;
    }
    return result;
  }
  return undefined;
}

export function parseShowdownJson(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SHOWDOWN_STRUCTURE_CHANGED');
  return value as Record<string, unknown>;
}

export function parseShowdownModule(raw: string, exportName: string): Record<string, unknown> {
  const ast = acorn.parse(raw, { ecmaVersion: 'latest', sourceType: 'script' });
  for (const statement of ast.body) {
    if (statement.type !== 'ExpressionStatement' || statement.expression.type !== 'AssignmentExpression') continue;
    const assignment = statement.expression;
    const left = assignment.left;
    if (left.type !== 'MemberExpression' || left.computed || left.object.type !== 'Identifier' || left.object.name !== 'exports') continue;
    if (left.property.type !== 'Identifier' || left.property.name !== exportName) continue;
    const value = literal(assignment.right);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SHOWDOWN_STRUCTURE_CHANGED');
    return value as Record<string, unknown>;
  }
  throw new Error('SHOWDOWN_STRUCTURE_CHANGED');
}
