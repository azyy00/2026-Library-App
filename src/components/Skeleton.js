import React from 'react';

// Shimmer placeholder that matches the shape of the content it stands in for.
function Skeleton({ width = '100%', height = '1rem', radius = '8px', className = '', style = {} }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

// Renders a block of skeleton table rows so a loading table keeps its layout.
export function SkeletonRows({ rows = 5, columns = [] }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`skeleton-row-${rowIndex}`} className="skeleton-row" aria-hidden="true">
          {columns.map((column, columnIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${columnIndex}`} className={column.className || ''}>
              <Skeleton width={column.width || '100%'} height={column.height || '0.95rem'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default Skeleton;
