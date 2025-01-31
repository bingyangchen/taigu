import React from "react";

import { asIcon } from "./IconLayout";

interface Props {}
interface State {}

class IconMemo extends React.Component<Props, State> {
    public state: State;

    public constructor(props: Props) {
        super(props);
        this.state = {};
    }

    public render(): React.ReactNode {
        return (
            <path d="m16,0h-8C5.243,0,3,2.243,3,5v14c0,2.757,2.243,5,5,5h8c2.757,0,5-2.243,5-5V5c0-2.757-2.243-5-5-5Zm3,19c0,1.654-1.346,3-3,3h-8c-1.654,0-3-1.346-3-3V5c0-1.654,1.346-3,3-3h8c1.654,0,3,1.346,3,3v14Zm-2-13c0,.553-.447,1-1,1h-8c-.553,0-1-.447-1-1s.447-1,1-1h8c.553,0,1,.447,1,1Zm0,5c0,.553-.447,1-1,1h-8c-.553,0-1-.447-1-1s.447-1,1-1h8c.553,0,1,.447,1,1Zm-4,5c0,.553-.447,1-1,1h-4c-.553,0-1-.447-1-1s.447-1,1-1h4c.553,0,1,.447,1,1Z" />
        );
    }
}

export default asIcon(IconMemo);
