# Superset Custom Table Plugin - Documentación Completa

## 📋 Información General

**Nombre del Plugin**: `@superset-ui/plugin-chart-custom-table`  
**Versión**: 0.20.3  
**Ubicación**: `/superset-frontend/plugins/plugin-chart-custom-table/`  
**Propósito**: Plugin de tabla personalizado para Apache Superset con funcionalidad avanzada de templates Jinja para nombres de columnas dinámicos  

## 🎯 Funcionalidades Principales

### 1. **Sistema Jinja Fields**
- **Descripción**: Permite usar métricas auxiliares en templates de nombres de columnas sin mostrarlas como columnas separadas
- **Funcionalidad**: Los "Jinja Fields" son métricas que se calculan pero se filtran de la visualización, permitiendo usar sus valores en templates
- **Casos de uso**: Crear nombres de columnas dinámicos basados en valores calculados (ej: "Ventas del año {{MAX(anio_id)}}")

### 2. **Dynamic Column Names**
- **Descripción**: Sistema de templates Jinja para generar nombres de columnas dinámicos
- **Motor de templates**: Soporte completo para condicionales `if/elif/else/endif`
- **Variables disponibles**: `{{column_name}}`, `{{row_count}}`, `{{data}}`, `{{first_row}}`, `{{last_row}}`, y cualquier métrica de Jinja Fields

### 3. **Template Helper**
- **Descripción**: Herramientas de ayuda integradas en el control panel
- **Funciones**: Mostrar templates guardados, ejemplos, y documentación completa
- **Solución a problemas**: Ayuda al usuario cuando el campo de template aparece vacío tras recargar

## 🏗️ Arquitectura del Plugin

### Estructura de Archivos

```
plugin-chart-custom-table/
├── src/
│   ├── controlPanel.tsx          # Configuración UI del plugin
│   ├── buildQuery.ts             # Construcción de queries con jinja_fields
│   ├── transformProps.ts         # Transformación de datos y filtrado
│   ├── TableChart.tsx           # Componente React principal
│   ├── types.ts                 # Definiciones TypeScript
│   ├── utils/
│   │   └── jinjaRenderer.ts     # Motor de templates Jinja
│   └── ...
├── COMPLETE_DOCUMENTATION.md    # Esta documentación
├── JINJA_FIELDS_DOCUMENTATION.md # Documentación específica de Jinja Fields
└── package.json
```

## 🔧 Componentes Técnicos Detallados

### 1. **controlPanel.tsx**

**Función**: Define la interfaz de usuario del plugin en el panel de configuración de Superset.

**Controles principales**:
- `enable_dynamic_column_names`: Checkbox para activar el sistema
- `jinja_fields`: Control para métricas auxiliares
- `column_name_template`: TextArea para el template Jinja
- `show_template_helper`: SelectControl con herramientas de ayuda

**Importaciones clave**:
```typescript
import {
  ControlConfig,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
```

**Funcionalidad del Template Helper**:
```typescript
// Tres opciones principales:
choices: [
  ['console', '🔍 Ver en Consola'],
  ['help', '❓ Ayuda Completa'], 
  ['examples', '💡 Ejemplos'],
]
```

### 2. **buildQuery.ts**

**Función**: Modifica la query para incluir jinja_fields cuando están definidos.

**Lógica principal**:
```typescript
// Si hay jinja_fields definidos, los agrega a las métricas
if (formData.jinja_fields && formData.jinja_fields.length > 0) {
  const jinjaFields = ensureIsArray(formData.jinja_fields);
  const allMetrics = [...(queries[0].metrics || []), ...jinjaFields];
  queries[0].metrics = removeDuplicates(allMetrics, 'metric_name');
}
```

**Importaciones clave**:
```typescript
import { buildQueryContext, QueryFormData } from '@superset-ui/core';
import { ensureIsArray } from '@superset-ui/core';
```

### 3. **transformProps.ts**

**Función**: Procesa los datos recibidos del backend y prepara la información para el componente de tabla.

**Funcionalidades principales**:
- Extrae valores de jinja_fields de los datos
- Filtra jinja_fields para que no aparezcan como columnas
- Pasa jinjaFieldValues al componente de tabla

**Lógica de extracción de Jinja Fields**:
```typescript
const jinjaFieldValues: { [key: string]: any } = {};
if (queriesData?.[0]?.data && formData.jinja_fields) {
  const jinjaFields = ensureIsArray(formData.jinja_fields);
  jinjaFields.forEach(field => {
    if (typeof field === 'object' && field.label) {
      const columnKey = field.label;
      if (data.length > 0 && data[0][columnKey] !== undefined) {
        jinjaFieldValues[field.label] = data[0][columnKey];
      }
    }
  });
}
```

**Filtrado de columnas**:
```typescript
const filteredColumns = coltypes
  .map((colType, index) => ({ colType, index }))
  .filter(({ index }) => {
    // Filtra jinja_fields de las columnas mostradas
    return !isJinjaField(colnames[index], formData.jinja_fields);
  });
```

### 4. **jinjaRenderer.ts**

**Función**: Motor de templates Jinja que procesa los templates de nombres de columnas.

**Funcionalidades**:
- Procesamiento de condicionales `if/elif/else/endif`
- Sustitución de variables
- Manejo de errores y logging

**Función principal**:
```typescript
export function renderJinjaTemplate(
  template: string,
  context: { [key: string]: any }
): string
```

**Procesamiento de condicionales**:
```typescript
function processConditionalBlocks(template: string, context: any): string {
  // Maneja bloques {% if %} {% elif %} {% else %} {% endif %}
  const ifBlockRegex = /{%\s*if\s+([^%]+)\s*%}(.*?)(?:{%\s*elif\s+([^%]+)\s*%}(.*?))*(?:{%\s*else\s*%}(.*?))?{%\s*endif\s*%}/gs;
  
  return template.replace(ifBlockRegex, (match, ...args) => {
    // Procesa las condiciones y retorna el resultado apropiado
  });
}
```

### 5. **TableChart.tsx**

**Función**: Componente React principal que renderiza la tabla.

**Props principales**:
```typescript
interface TableChartProps {
  data: DataRecord[];
  height: number;
  width: number;
  columnConfigs: ColumnConfig[];
  serverPagination: boolean;
  jinjaFieldValues: { [key: string]: any }; // Valores de jinja fields
  // ... otros props
}
```

**Procesamiento de nombres de columnas dinámicos**:
```typescript
const getColumnConfigs = useCallback(() => {
  if (enableDynamicColumnNames && columnNameTemplate) {
    // Aplica el template a cada columna
    return processedColumns.map(config => ({
      ...config,
      label: renderJinjaTemplate(columnNameTemplate, {
        column_name: config.label,
        data: data,
        row_count: data.length,
        first_row: data[0] || {},
        last_row: data[data.length - 1] || {},
        ...jinjaFieldValues
      })
    }));
  }
  return processedColumns;
}, [enableDynamicColumnNames, columnNameTemplate, processedColumns, data, jinjaFieldValues]);
```

### 6. **types.ts**

**Función**: Define todas las interfaces TypeScript del plugin.

**Interfaces principales**:
```typescript
// Configuración del formulario
export interface CustomTableFormData extends QueryFormData {
  enable_dynamic_column_names?: boolean;
  column_name_template?: string;
  jinja_fields?: QueryFormMetric[];
  use_metric_in_column_names?: boolean;
  show_template_helper?: string;
}

// Props del componente principal
export interface CustomTableChartProps {
  data: DataRecord[];
  jinjaFieldValues: { [key: string]: any };
  enableDynamicColumnNames: boolean;
  columnNameTemplate: string;
  // ... otros props
}

// Configuración de columnas
export interface ColumnConfig {
  key: string;
  label: string;
  type: GenericDataType;
  // ... otros campos
}
```

## 🔄 Flujo de Datos Completo

### 1. **Configuración del Usuario**
```
Usuario configura en Control Panel:
├── Activa "Enable dynamic column names"
├── Define "Jinja Fields" (métricas auxiliares)
├── Escribe "Column name template" (template Jinja)
└── Guarda dashboard
```

### 2. **Construcción de Query**
```
buildQuery.ts:
├── Toma métricas normales del usuario
├── Agrega jinja_fields a las métricas
├── Envía query expandida al backend
└── Retorna datos incluyendo valores de jinja_fields
```

### 3. **Transformación de Datos**
```
transformProps.ts:
├── Recibe datos del backend
├── Extrae valores de jinja_fields
├── Filtra jinja_fields de columnas mostradas
├── Prepara jinjaFieldValues para el componente
└── Pasa datos procesados a TableChart
```

### 4. **Renderizado de Tabla**
```
TableChart.tsx:
├── Recibe datos y jinjaFieldValues
├── Aplica template a cada nombre de columna
├── Usa jinjaRenderer para procesar templates
├── Renderiza tabla con nombres dinámicos
└── Excluye jinja_fields de columnas mostradas
```

### 5. **Procesamiento de Templates**
```
jinjaRenderer.ts:
├── Recibe template y contexto de variables
├── Procesa condicionales if/elif/else/endif
├── Sustituye variables {{variable_name}}
├── Maneja errores y logging
└── Retorna nombre de columna procesado
```

## 🛠️ Variables de Template Disponibles

### Variables del Sistema
- `{{column_name}}`: Nombre original de la columna
- `{{row_count}}`: Número total de filas en los datos
- `{{data}}`: Array completo de datos (uso avanzado)
- `{{first_row}}`: Primer registro de datos
- `{{last_row}}`: Último registro de datos

### Variables de Jinja Fields
- `{{MAX(metrica)}}`: Valor máximo de cualquier métrica definida en jinja_fields
- `{{MIN(metrica)}}`: Valor mínimo de cualquier métrica definida en jinja_fields
- `{{SUM(metrica)}}`: Suma de cualquier métrica definida en jinja_fields
- `{{AVG(metrica)}}`: Promedio de cualquier métrica definida en jinja_fields

### Contexto Extendido
Todas las métricas definidas en "Jinja Fields" están disponibles como variables en el template usando su nombre de etiqueta.

## 📝 Sintaxis de Templates Jinja

### 1. **Variables Simples**
```jinja
{{column_name}} ({{row_count}} filas)
Ventas {{MAX(anio_id)}}
```

### 2. **Condicionales Básicos**
```jinja
{% if MAX(anio_id) > 2020 %}
{{column_name}} - Actual
{% else %}
{{column_name}} - Histórico
{% endif %}
```

### 3. **Condicionales Múltiples**
```jinja
{% if column_name == 'SUM(sell_out)' %}
Ventas del año {{MAX(anio_id)}}
{% elif column_name == 'jefe_marca' %}
Jefe de Marca
{% else %}
{{column_name}}
{% endif %}
```

### 4. **Condicionales con elif**
```jinja
{% if MAX(anio_id) >= 2024 %}
{{column_name}} - 2024
{% elif MAX(anio_id) >= 2020 %}
{{column_name}} - Reciente
{% else %}
{{column_name}} - Histórico
{% endif %}
```

## 🔍 Debugging y Logs

### Logs del Sistema
El plugin genera logs detallados en la consola del navegador:

```javascript
// Template Helper Debug
console.log('Template Helper Debug - All Methods:', {...});

// Jinja Fields Processing
console.log('Jinja Fields found:', jinjaFields);
console.log('Jinja field values extracted:', jinjaFieldValues);

// Template Processing
console.log('Original template:', template);
console.log('Template applied:', result);
console.log('Dynamic name generated:', dynamicName);
```

### Verificación de Funcionamiento
1. **F12 → Console**: Ver logs de procesamiento
2. **Buscar "Template applied:"**: Confirmar que templates se ejecutan
3. **Verificar "Jinja field values"**: Confirmar extracción de valores
4. **Revisar "Dynamic name generated"**: Ver nombres finales

## ⚙️ Configuración y Instalación

### Dependencias Principales
```json
{
  "@superset-ui/chart-controls": "^0.20.3",
  "@superset-ui/core": "^0.20.3",
  "@superset-ui/chart-controls": "^0.20.3"
}
```

### Compilación
```bash
# Desde superset-frontend/
npm run build

# O específicamente para este plugin
cd plugins/plugin-chart-custom-table
npm run build
```

### Integración en Superset
El plugin está registrado automáticamente en Superset cuando se compila el frontend.

## 🚨 Problemas Conocidos y Soluciones

### 1. **Campo de Template Aparece Vacío**
**Problema**: Después de recargar la página, el campo "Column name template" puede aparecer vacío visualmente.
**Solución**: 
- El template sigue funcionando correctamente
- Usar Template Helper → "🔍 Ver en Consola" para acceder al código
- Verificar logs en consola del navegador

### 2. **Jinja Fields Aparecen Como Columnas**
**Problema**: Las métricas auxiliares se muestran como columnas en la tabla.
**Solución**: 
- Verificar que `transformProps.ts` está filtrando correctamente
- Revisar función `isJinjaField` en el filtrado

### 3. **Templates No Se Procesan**
**Problema**: Los templates Jinja no se aplican a los nombres de columnas.
**Solución**:
- Verificar que "Enable dynamic column names" está activado
- Confirmar que hay contenido en "Column name template"
- Revisar logs de consola para errores en `jinjaRenderer.ts`

## 🔮 Extensibilidad y Modificaciones Futuras

### Agregar Nuevas Variables
1. **En transformProps.ts**: Agregar la variable al contexto pasado a TableChart
2. **En TableChart.tsx**: Incluir la variable en el contexto del template
3. **En jinjaRenderer.ts**: Asegurar que el motor procese la nueva variable

### Agregar Nuevas Funciones de Template
1. **En jinjaRenderer.ts**: Extender el motor con nuevas funciones
2. **En controlPanel.tsx**: Actualizar la ayuda del Template Helper
3. **En esta documentación**: Documentar las nuevas funciones

### Mejorar el Template Helper
1. **En controlPanel.tsx**: Modificar las opciones del SelectControl
2. **Agregar nuevas opciones**: Ejemplo, preview de template, validador de sintaxis
3. **Mejorar acceso a templates**: Solucionar el problema de acceso al estado

## 📚 Referencias y Recursos

### Archivos de Configuración
- **package.json**: Configuración del plugin y dependencias
- **tsconfig.json**: Configuración TypeScript
- **JINJA_FIELDS_DOCUMENTATION.md**: Documentación específica de Jinja Fields

### APIs de Superset Utilizadas
- **Chart Controls API**: Para controles del panel de configuración
- **Query API**: Para construcción y ejecución de queries
- **Plugin API**: Para registro e integración del plugin

### Patrones de Desarrollo
- **Hooks de React**: useState, useCallback, useEffect para estado del componente
- **TypeScript**: Tipos estrictos para todas las interfaces
- **Superset Patterns**: Siguiendo patrones estándar de plugins de Superset

---

## 📝 Notas para IAs Futuras

### Estructura del Código
- **Separación de responsabilidades**: Cada archivo tiene una función específica bien definida
- **Flujo unidireccional**: Los datos fluyen desde buildQuery → transformProps → TableChart → jinjaRenderer
- **Inmutabilidad**: Los datos se transforman sin mutar los originales

### Puntos de Extensión
- **jinjaRenderer.ts**: Motor de templates extensible para nuevas funciones
- **controlPanel.tsx**: Fácil agregar nuevos controles
- **transformProps.ts**: Punto central para nuevas transformaciones de datos
- **types.ts**: Todas las interfaces centralizadas para fácil modificación

### Principios de Diseño
- **Robustez**: Manejo de errores en todos los niveles
- **Debugging**: Logs extensivos para troubleshooting
- **Usabilidad**: Template Helper para ayudar a usuarios
- **Flexibilidad**: Sistema de templates Jinja completo y extensible

Esta documentación debe permitir a cualquier IA comprender completamente el plugin y realizar modificaciones de manera eficiente y segura.