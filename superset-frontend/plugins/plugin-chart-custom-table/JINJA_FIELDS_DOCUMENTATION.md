# Funcionalidad de Jinja Fields para Columnas Dinámicas

## Descripción

La nueva funcionalidad "Jinja Fields" permite agregar métricas auxiliares que no se renderizan como columnas en la tabla, pero están disponibles para usar en los nombres de las columnas a través de plantillas Jinja.

## Casos de Uso

Ideal para cuando necesitas valores calculados (como MAX, SUM, etc.) únicamente para personalizar los títulos de las columnas sin que aparezcan como columnas adicionales en la tabla.

## Ejemplo de Configuración

### Configuración de Campos

1. **Dimensiones**: `jefe_marca` (aparece como columna en la tabla)
2. **Métricas**: `SUM(sell_in)` (aparece como columna en la tabla)
3. **Jinja Fields**: `MAX(anio_id)` (NO aparece como columna, solo para plantillas)

### Configuración de Nombres de Columnas

En el campo "Column Name Template", puedes usar:

#### Para jefe_marca:
```
{{transformed_name}}
```
Resultado: "Jefe Marca" (transformación automática)

#### Para SUM(sell_in):
```
Ventas del año {{MAX(anio_id)}}
```
Resultado: "Ventas del año 2024" (asumiendo que MAX(anio_id) = 2024)

Alternativamente:
```
{{transformed_name}} del año {{MAX(anio_id)}}
```
Resultado: "Total Sell In del año 2024"

## Variables Disponibles en las Plantillas

### Variables del Jinja Field
- `{{MAX(anio_id)}}`: El valor calculado del campo auxiliar
- `{{SUM(ventas)}}`: Cualquier otra métrica definida en Jinja Fields

### Variables de la Columna
- `{{column_name}}`: Nombre original de la columna
- `{{transformed_name}}`: Nombre transformado automáticamente
- `{{max_year}}`: Año máximo detectado automáticamente
- `{{year}}`: Alias para max_year

### Variables de Datos
- `{{row_count}}`: Número total de filas
- `{{sum}}`, `{{avg}}`, `{{max}}`, `{{min}}`: Estadísticas de la columna (si es numérica)

## Transformaciones Automáticas

El sistema incluye transformaciones automáticas para campos comunes:

- `jefe_marca` → "Jefe Marca"
- `sell_in` → "Sell In"
- `anio_id` → "Año"
- `SUM(sell_in)` → "Total Sell In"
- `MAX(anio_id)` → "Máximo Año"

## Flujo de Trabajo Completo

1. **Agregar Dimensiones**: Los campos que aparecerán como columnas agrupadas
2. **Agregar Métricas**: Los cálculos que aparecerán como columnas de datos
3. **Agregar Jinja Fields**: Métricas auxiliares solo para títulos (ej: MAX(anio_id))
4. **Configurar Plantillas**: Usar las variables en "Column Name Template"
5. **Habilitar Dynamic Column Names**: Activar la funcionalidad

## Ejemplo Práctico

### Configuración:
- **Dimensiones**: `jefe_marca`
- **Métricas**: `SUM(sell_in)`
- **Jinja Fields**: `MAX(anio_id)`
- **Template para jefe_marca**: `{{transformed_name}}`
- **Template para SUM(sell_in)**: `Ventas del año {{MAX(anio_id)}}`

### Resultado:
- Columna 1: "Jefe Marca" (datos de jefe_marca)
- Columna 2: "Ventas del año 2024" (datos de SUM(sell_in))

La tabla solo mostrará 2 columnas, pero el título de la segunda columna incluye el año obtenido de MAX(anio_id).