import React from 'react';
import './DataTable.css';

export interface Column<T extends DataRecord> {
  header: string;
  key: keyof T;  // Ensure key is a valid property of T
  render?: (item: T) => string | number | React.ReactNode;
}

// Create a base type for data objects
export interface DataRecord {
  [key: string]: string | number | boolean | null | undefined | Array<string | number>;
}

interface DataTableProps<T extends DataRecord> {  // Ensure T is an object type
  data: T[];
  columns: Column<T>[];
  title?: string;
  className?: string;
}

function DataTable<T extends DataRecord>({ data, columns, title, className = '' }: DataTableProps<T>) {
  return (
    <div className={`data-table ${className}`}>
      {title && <h3>{title}</h3>}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <td key={`${rowIndex}-${colIndex}`}>
                    {column.render 
                      ? column.render(item)
                      : item[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
