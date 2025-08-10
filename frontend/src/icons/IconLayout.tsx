import React from "react";

interface IIconProps {
  sideLength?: string;
  color?: string;
}

export function asIcon<T>(Component: React.ComponentType<T>) {
  return (props: T & IIconProps) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={props.sideLength || "16"}
        height={props.sideLength || "16"}
        fill={props.color || "currentColor"}
        viewBox="0 0 24 24"
      >
        <Component {...props} />
      </svg>
    );
  };
}
