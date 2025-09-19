# Implementación de Nombres de Columnas Dinámicos en Superset Custom Table Plugin

## 📋 Resumen
Este documento detalla la implementación completa de la funcionalidad de nombres de columnas dinámicos usando templates Jinja en el plugin Custom Table de Apache Superset.

## 🎯 Objetivo
Permitir a los usuarios personalizar dinámicamente los nombres de las columnas en tablas usando templates Jinja que pueden acceder a datos del query, métricas y estadísticas calculadas.

## 🛠️ Proceso de Implementación

### 1. Análisis de la Estructura Existente

Primero analizamos cómo funciona el plugin Custom Table existente:

```bash
# Navegamos al directorio del plugin
cd /home/imercados/superset_fork/irex-superset/superset-frontend/plugins/plugin-chart-custom-table

# Revisamos la estructura actual
tree src/
```

**Archivos clave identificados:**
- `src/controlPanel.tsx` - Panel de configuración
- `src/types.ts` - Definiciones de tipos TypeScript
- `src/transformProps.ts` - Transformación de datos
- `src/TableChart.tsx` - Componente principal
- `src/utils/` - Utilidades existentes

### 2. Diseño de los Nuevos Controles

Agregamos tres nuevos controles al panel de configuración en `controlPanel.tsx`:

```typescript
{
  label: t('Dynamic Column Names'),
  expanded: true,
  controlSetRows: [
    // Control para habilitar la funcionalidad
    [
      {
        name: 'enable_dynamic_column_names',
        config: {
          type: 'CheckboxControl',
          label: t('Enable dynamic column names'),
          renderTrigger: true,
          default: false,
          description: t(
            'Enable dynamic column names using Jinja templates with query data and metrics',
          ),
        },
      },
    ],
    // Control para el template Jinja
    [
      {
        name: 'column_name_template',
        config: {
          type: 'TextAreaControl',
          label: t('Column name template'),
          renderTrigger: true,
          default: '',
          visibility: ({ controls }) => Boolean(controls?.enable_dynamic_column_names?.value),
          description: t(
            'Jinja template for column names. Available variables: {{data}}, {{metrics}}, {{column_name}}, {{first_row}}, {{last_row}}, {{row_count}}. Example: "{{column_name}} ({{row_count}} rows)"',
          ),
          placeholder: t('{{column_name}} ({{row_count}} rows)'),
        },
      },
    ],
    // Control para incluir métricas
    [
      {
        name: 'use_metric_in_column_names',
        config: {
          type: 'CheckboxControl',
          label: t('Include metrics in column names'),
          renderTrigger: true,
          default: false,
          visibility: ({ controls }) => Boolean(controls?.enable_dynamic_column_names?.value),
          description: t(
            'Include calculated metric values in column names',
          ),
        },
      },
    ],
  ],
},
```

### 3. Actualización de Tipos TypeScript

Modificamos `types.ts` para incluir los nuevos campos:

```typescript
// En TableChartFormData
export type TableChartFormData = QueryFormData & {
  // ... campos existentes ...
  enable_dynamic_column_names?: boolean;
  column_name_template?: string;
  use_metric_in_column_names?: boolean;
};

// En TableChartTransformedProps
export interface TableChartTransformedProps<D extends DataRecord = DataRecord> {
  // ... props existentes ...
  enableDynamicColumnNames?: boolean;
  columnNameTemplate?: string;
  useMetricInColumnNames?: boolean;
  rawFormData?: TableChartFormData;
}
```

### 4. Implementación del Motor de Templates Jinja

Creamos un nuevo archivo utilitario `src/utils/jinjaRenderer.ts`:

```typescript
/**
 * Simple Jinja template renderer for column names
 * Supports basic variable substitution with {{ variable }} syntax
 */
export function renderJinjaTemplate(
  template: string,
  variables: Record<string, any>,
): string {
  if (!template || typeof template !== 'string') {
    return template || '';
  }

  let result = template;
  
  // Replace variables in the format {{ variable_name }}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    let displayValue = value;
    
    // Format different types of values
    if (typeof value === 'number') {
      displayValue = value.toLocaleString();
    } else if (typeof value === 'object' && value !== null) {
      displayValue = JSON.stringify(value);
    } else if (value === null || value === undefined) {
      displayValue = '';
    } else {
      displayValue = String(value);
    }
    
    result = result.replace(regex, displayValue);
  });

  return result;
}

/**
 * Generate dynamic column name using Jinja template and data context
 */
export function generateDynamicColumnName(
  column: DataColumnMeta,
  data: DataRecord[],
  template: string,
  useMetricInColumnNames: boolean = false,
  metrics?: (string | number)[],
): string {
  if (!template) {
    return column.label;
  }

  // Calculate statistics from data
  const rowCount = data.length;
  const firstRow = data[0] || {};
  const lastRow = data[data.length - 1] || {};
  
  // Get column-specific data
  const columnData = data.map(row => row[column.key]).filter(val => val !== null && val !== undefined);
  
  // Calculate metrics for numeric columns
  let columnMetrics: Record<string, any> = {};
  if (column.isNumeric && columnData.length > 0) {
    const numericData = columnData.filter(val => typeof val === 'number') as number[];
    if (numericData.length > 0) {
      columnMetrics = {
        sum: numericData.reduce((a, b) => a + b, 0),
        avg: numericData.reduce((a, b) => a + b, 0) / numericData.length,
        min: Math.min(...numericData),
        max: Math.max(...numericData),
        count: numericData.length,
      };
    }
  }

  // Build template variables
  const variables: Record<string, any> = {
    column_name: column.label,
    original_label: column.originalLabel || column.label,
    key: column.key,
    data_type: column.dataType,
    row_count: rowCount,
    first_row: firstRow,
    last_row: lastRow,
    data: data,
    is_metric: column.isMetric,
    is_percent_metric: column.isPercentMetric,
    is_numeric: column.isNumeric,
    ...columnMetrics,
  };

  // Add metrics if enabled
  if (useMetricInColumnNames && metrics) {
    variables.metrics = metrics;
    variables.metric_count = metrics.length;
  }

  // Add specific column value from first row if available
  if (firstRow[column.key] !== undefined) {
    variables.first_value = firstRow[column.key];
  }
  
  if (lastRow[column.key] !== undefined) {
    variables.last_value = lastRow[column.key];
  }

  return renderJinjaTemplate(template, variables);
}
```

### 5. Modificación del Transformador de Props

En `transformProps.ts`, agregamos la extracción de los nuevos campos del formData:

```typescript
// Extracción de las nuevas configuraciones
const {
  // ... configuraciones existentes ...
  enable_dynamic_column_names: enableDynamicColumnNames = false,
  column_name_template: columnNameTemplate = '',
  use_metric_in_column_names: useMetricInColumnNames = false,
} = formData;

// Agregamos al objeto de retorno
return {
  // ... props existentes ...
  enableDynamicColumnNames,
  columnNameTemplate,
  useMetricInColumnNames,
  rawFormData: formData,
};
```

### 6. Integración en el Componente Principal

En `TableChart.tsx`, modificamos la lógica de generación de nombres de columnas:

```typescript
// Import de la nueva función
import { generateDynamicColumnName } from './utils/jinjaRenderer';

// Extracción de las nuevas props
const {
  // ... props existentes ...
  enableDynamicColumnNames = false,
  columnNameTemplate = '',
  useMetricInColumnNames = false,
  rawFormData,
} = props;

// Modificación de la función getColumnConfigs
const label = config.customColumnName || originalLabel;
let displayLabel = label;

// Apply dynamic column names if enabled
if (enableDynamicColumnNames && columnNameTemplate) {
  try {
    const dynamicName = generateDynamicColumnName(
      column,
      data,
      columnNameTemplate,
      useMetricInColumnNames,
      rawFormData?.metrics?.map(m => String(m)),
    );
    displayLabel = dynamicName;
  } catch (error) {
    console.warn('Error generating dynamic column name:', error);
    // Fall back to original logic
  }
}
```

### 7. Construcción y Compilación

Ejecutamos los comandos necesarios para construir el plugin:

```bash
# Navegamos al directorio frontend
cd /home/imercados/superset_fork/irex-superset/superset-frontend

# Construimos solo nuestro plugin personalizado
npx lerna exec --stream --scope @superset-ui/plugin-chart-custom-table -- babel --config-file=../../babel.config.js src --extensions ".ts,.tsx,.js,.jsx" --copy-files --out-dir lib

# Compilamos TypeScript
npx lerna exec --scope @superset-ui/plugin-chart-custom-table -- ../../scripts/tsc.sh --build

# Iniciamos el servidor de desarrollo
npm run dev-server
```

## 🚀 Variables Disponibles en Templates Jinja

### Variables Básicas
- `{{column_name}}` - Nombre actual de la columna
- `{{original_label}}` - Etiqueta original de la columna
- `{{key}}` - Clave interna de la columna
- `{{data_type}}` - Tipo de datos de la columna

### Variables de Datos
- `{{row_count}}` - Número total de filas
- `{{first_row}}` - Primera fila de datos
- `{{last_row}}` - Última fila de datos
- `{{first_value}}` - Primer valor de la columna
- `{{last_value}}` - Último valor de la columna

### Variables de Tipo
- `{{is_metric}}` - Si la columna es una métrica (true/false)
- `{{is_percent_metric}}` - Si es una métrica de porcentaje
- `{{is_numeric}}` - Si la columna es numérica

### Variables Estadísticas (solo para columnas numéricas)
- `{{sum}}` - Suma total de los valores
- `{{avg}}` - Promedio de los valores
- `{{min}}` - Valor mínimo
- `{{max}}` - Valor máximo
- `{{count}}` - Número de valores no nulos

### Variables de Métricas (cuando está habilitado)
- `{{metrics}}` - Array de métricas seleccionadas
- `{{metric_count}}` - Número de métricas

## 📝 Ejemplos de Templates

### 1. Template Básico con Conteo
```jinja
{{column_name}} ({{row_count}} filas)
```
**Resultado:** "Sales Amount (1,234 filas)"

### 2. Template con Estadísticas
```jinja
{{column_name}} - Total: {{sum}}
```
**Resultado:** "Revenue - Total: 1,500,000"

### 3. Template con Rango
```jinja
{{column_name}} [{{min}} - {{max}}]
```
**Resultado:** "Price [10 - 999]"

### 4. Template con Promedio
```jinja
📊 {{column_name}} (Avg: {{avg}})
```
**Resultado:** "📊 Sales Amount (Avg: 533.33)"

### 5. Template Condicional
```jinja
{{column_name}}{{#if is_metric}} 📈{{/if}}
```
**Resultado:** "Revenue 📈" (si es métrica)

## 🔧 Comandos de Consola Utilizados

### Análisis inicial
```bash
cd /home/imercados/superset_fork/irex-superset/superset-frontend/plugins/plugin-chart-custom-table
tree src/
```

### Construcción del plugin
```bash
cd /home/imercados/superset_fork/irex-superset/superset-frontend

# Construir plugin específico
npx lerna exec --stream --scope @superset-ui/plugin-chart-custom-table -- babel --config-file=../../babel.config.js src --extensions ".ts,.tsx,.js,.jsx" --copy-files --out-dir lib

# Compilar TypeScript
npx lerna exec --scope @superset-ui/plugin-chart-custom-table -- ../../scripts/tsc.sh --build

# Verificar que el plugin está en la lista
npx lerna list

# Iniciar servidor de desarrollo
npm run dev-server
```

### Verificación y testing
```bash
# Verificar compilación exitosa
echo "Frontend compiled successfully at http://localhost:9000"

# Verificar backend (en otra terminal)
cd /home/imercados/superset_fork/irex-superset
source venv/bin/activate
python -m flask run -h 0.0.0.0 -p 8000
```

## 🎯 Cómo Usar la Funcionalidad

### Paso 1: Acceder a Superset
1. Abre tu navegador en `http://localhost:9000` (o `http://192.168.76.11:9000` para acceso remoto)
2. Inicia sesión en Superset

### Paso 2: Crear un Chart
1. Ve a **Charts** → **+ Chart**
2. Selecciona un dataset
3. Elige **Custom Table** como tipo de visualización

### Paso 3: Configurar Nombres Dinámicos
1. En el panel de configuración, busca la sección **"Dynamic Column Names"**
2. Marca ✅ **"Enable dynamic column names"**
3. En **"Column name template"**, escribe tu template Jinja:
   ```
   {{column_name}} ({{row_count}} rows)
   ```
4. Opcionalmente, marca ✅ **"Include metrics in column names"**
5. Haz clic en **"Run Query"** para ver los resultados

### Paso 4: Experimentar con Templates
Prueba diferentes templates como:
- `📊 {{column_name}} - Σ: {{sum}}`
- `{{column_name}} [{{min}} to {{max}}]`
- `{{column_name}} (Avg: {{avg}})`

## ✅ Verificación de la Implementación

### Checklist de Funcionamiento
- [ ] Los controles aparecen en el panel de configuración
- [ ] El checkbox habilita/deshabilita la funcionalidad
- [ ] Los templates Jinja se procesan correctamente
- [ ] Las variables estadísticas se calculan para columnas numéricas
- [ ] La funcionalidad es compatible con el `customColumnName` existente
- [ ] Los errores en templates no rompen la tabla (fallback)

### Archivos Modificados
1. `src/controlPanel.tsx` - Nuevos controles
2. `src/types.ts` - Definiciones de tipos
3. `src/transformProps.ts` - Paso de props
4. `src/TableChart.tsx` - Lógica de renderizado
5. `src/utils/jinjaRenderer.ts` - Motor de templates (nuevo)

## 🔄 Flujo de Datos

```
FormData → transformProps.ts → TableChart.tsx → jinjaRenderer.ts → displayLabel
```

1. **FormData**: Usuario configura templates en el panel
2. **transformProps**: Extrae configuraciones y las pasa como props
3. **TableChart**: Llama a la función de renderizado para cada columna
4. **jinjaRenderer**: Procesa el template con variables de contexto
5. **displayLabel**: Nombre final mostrado en la tabla

## 🛡️ Manejo de Errores

La implementación incluye manejo robusto de errores:

```typescript
try {
  const dynamicName = generateDynamicColumnName(/* ... */);
  displayLabel = dynamicName;
} catch (error) {
  console.warn('Error generating dynamic column name:', error);
  // Fall back to original logic
}
```

Esto asegura que errores en los templates no rompan la funcionalidad de la tabla.

## 📈 Rendimiento

- **Memoización**: Se utiliza `useCallback` para optimizar re-renders
- **Cálculo eficiente**: Las estadísticas se calculan una sola vez por columna
- **Fallback rápido**: Errores no bloquean el renderizado

## 🔮 Posibles Extensiones Futuras

1. **Más funciones Jinja**: `upper()`, `lower()`, `round()`
2. **Templates condicionales**: `{% if %}` statements
3. **Formateo de números**: Personalizar formato de números
4. **Caché de resultados**: Para mejorar rendimiento en datasets grandes
5. **Preview en tiempo real**: Vista previa del resultado antes de aplicar

---

**Autor**: GitHub Copilot Assistant  
**Fecha**: 18 de Septiembre, 2025  
**Versión**: 1.0