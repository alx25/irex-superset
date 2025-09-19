/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Enhanced Jinja template renderer for column names
 * Supports variable substitution and conditional logic
 */
export function renderJinjaTemplate(
  template: string,
  variables: Record<string, any>,
  filterValues?: Record<string, any>,
): string {
  if (!template || typeof template !== 'string') {
    return template || '';
  }

  let result = template;
  
  // Process conditional blocks first
  result = processConditionalBlocks(result, variables);
  
  // Replace variables in the format {{ variable_name }}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
    let displayValue: string;
    
    // Format different types of values
    if (typeof value === 'number') {
      displayValue = (value as number).toLocaleString();
    } else if (typeof value === 'object' && value !== null) {
      displayValue = JSON.stringify(value as object);
    } else if (value === null || value === undefined) {
      displayValue = '';
    } else {
      displayValue = String(value as any);
    }
    
    console.log(`Replacing {{${key}}} with "${displayValue}"`);
    result = result.replace(regex, displayValue);
  });
  
  return result;
}

/**
 * Process Jinja conditional blocks
 * Supports {% if condition %} ... {% elif condition %} ... {% else %} ... {% endif %}
 */
function processConditionalBlocks(
  template: string,
  variables: Record<string, any>,
): string {
  // Enhanced pattern to match if/elif/else/endif blocks
  const fullBlockPattern = /\{\%\s*if\s+([^%}]+)\s*\%\}([\s\S]*?)\{\%\s*endif\s*\%\}/g;
  
  return template.replace(fullBlockPattern, (match, firstCondition, content) => {
    // Parse the content to find elif and else blocks
    const blocks: { type: 'if' | 'elif' | 'else'; condition?: string; content: string }[] = [];
    
    // Split content by elif and else tags
    const elifRegex = /\{\%\s*elif\s+([^%}]+)\s*\%\}/g;
    const elseRegex = /\{\%\s*else\s*\%\}/g;
    
    // Find all elif positions
    const elifMatches: { index: number; condition: string }[] = [];
    let elifMatch;
    while ((elifMatch = elifRegex.exec(content)) !== null) {
      elifMatches.push({ index: elifMatch.index, condition: elifMatch[1].trim() });
    }
    
    // Find else position
    const elseMatch = elseRegex.exec(content);
    const elseIndex = elseMatch ? elseMatch.index : -1;
    
    // Create all breakpoints
    const breakpoints = [
      ...elifMatches.map(m => ({ index: m.index, type: 'elif' as const, condition: m.condition })),
      ...(elseIndex >= 0 ? [{ index: elseIndex, type: 'else' as const, condition: undefined }] : [])
    ].sort((a, b) => a.index - b.index);
    
    // Extract content for if block
    const firstBlockEnd = breakpoints.length > 0 ? breakpoints[0].index : content.length;
    blocks.push({
      type: 'if',
      condition: firstCondition.trim(),
      content: content.substring(0, firstBlockEnd).trim()
    });
    
    // Extract content for elif/else blocks
    for (let i = 0; i < breakpoints.length; i++) {
      const currentBreakpoint = breakpoints[i];
      const nextBreakpoint = breakpoints[i + 1];
      
      // Skip the tag itself
      const tagEnd = content.indexOf('%}', currentBreakpoint.index) + 2;
      const blockEnd = nextBreakpoint ? nextBreakpoint.index : content.length;
      const blockContent = content.substring(tagEnd, blockEnd).trim();
      
      blocks.push({
        type: currentBreakpoint.type,
        condition: currentBreakpoint.condition,
        content: blockContent
      });
    }
    
    // Evaluate conditions in order
    for (const block of blocks) {
      if (block.type === 'else') {
        return block.content; // Return else content if no previous conditions matched
      }
      
      if (block.condition && evaluateCondition(block.condition, variables)) {
        return block.content;
      }
    }
    
    return ''; // No conditions matched and no else block
  });
}

/**
 * Evaluate a simple condition
 * Supports: variable == 'value', variable.startswith('prefix'), etc.
 */
function evaluateCondition(
  condition: string,
  variables: Record<string, any>,
): boolean {
  try {
    // Handle == comparison
    const equalMatch = condition.match(/(.+?)\s*==\s*['"](.+?)['"]/);
    if (equalMatch) {
      const [, varName, expectedValue] = equalMatch;
      const actualValue = variables[varName.trim()];
      return String(actualValue) === expectedValue;
    }
    
    // Handle .startswith() method
    const startsWithMatch = condition.match(/(.+?)\.startswith\(['"](.+?)['"]\)/);
    if (startsWithMatch) {
      const [, varName, prefix] = startsWithMatch;
      const actualValue = String(variables[varName.trim()] || '');
      return actualValue.startsWith(prefix);
    }
    
    // Handle simple variable existence
    const varName = condition.trim();
    if (variables.hasOwnProperty(varName)) {
      const value = variables[varName];
      return Boolean(value);
    }
    
    return false;
  } catch (error) {
    console.warn('Error evaluating condition:', condition, error);
    return false;
  }
}/**
 * Transform common column names to more readable formats
 */
export function transformColumnName(columnName: string): string {
  // Common transformations
  const transformations: Record<string, string> = {
    'jefe_marca': 'Jefe Marca',
    'sell_in': 'Sell In',
    'anio_id': 'Año',
    'mes_id': 'Mes',
    'fecha': 'Fecha',
    // Add more transformations as needed
  };

  // Handle SUM, COUNT, AVG, etc. functions
  const functionRegex = /^(SUM|COUNT|AVG|MAX|MIN)\((.*)\)$/i;
  const match = columnName.match(functionRegex);
  
  if (match) {
    const func = match[1].toUpperCase();
    const field = match[2];
    const transformedField = transformations[field] || field;
    
    switch (func) {
      case 'SUM':
        return `Total ${transformedField}`;
      case 'COUNT':
        return `Cantidad ${transformedField}`;
      case 'AVG':
        return `Promedio ${transformedField}`;
      case 'MAX':
        return `Máximo ${transformedField}`;
      case 'MIN':
        return `Mínimo ${transformedField}`;
      default:
        return `${func} ${transformedField}`;
    }
  }
  
  // Direct transformation
  return transformations[columnName] || columnName;
}

/**
 * Generate dynamic column name using Jinja template and data context
 */
export function generateDynamicColumnName(
  template: string, 
  jinjaFieldValues: Record<string, any>, 
  filterValues?: Record<string, any>
): string {
  if (!template) return '';
  
  console.log(`=== DEBUGGING TEMPLATE ===`);
  console.log(`Original template: ${template}`);
  console.log('Available jinjaFieldValues:', jinjaFieldValues);
  console.log('jinjaFieldValues keys:', Object.keys(jinjaFieldValues));
  
  // Check for specific keys that might be missing
  console.log('Looking for MAX(anio_id):', jinjaFieldValues['MAX(anio_id)']);
  console.log('Looking for anio_id:', jinjaFieldValues['anio_id']);
  console.log('All keys containing "anio":', Object.keys(jinjaFieldValues).filter(k => k.includes('anio')));
  
  // Use the basic renderJinjaTemplate function
  const result = renderJinjaTemplate(template, jinjaFieldValues);
  
  console.log(`Final result: ${result}`);
  console.log(`=== END DEBUG ===`);
  
  return result.trim();
}

/**
 * Escape HTML in strings to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}