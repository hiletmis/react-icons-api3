# Getting started 

## Installation

```bash
yarn add react-icons-api
```

## Usage

```jsx
import React from 'react';
import { ChainIcon, SymbolIcon } from 'react-icons-api';

const App = () => (
  <div>
    <ChainIcon id={'1'} width={50} height={50} />
    <SymbolIcon id={'BTC'} width={50} height={50} />
  </div>
);

export default App;
```

## API

### ChainIcon

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| id | string |  | Chain id  |

### SymbolIcon

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| id | string |  | Symbol id  |

## License

MIT © [react-icons-api]

<!-- prettier-ignore-end -->