import type { Meta } from "@storybook/react-vite";

export default {
  title: "Example story",
  parameters: {
    layout: "fullscreen",
  },
} as Meta;

export const Example = {
  render: () => (
    <div>
      <h1>Example Component</h1>
      <p>This is an example component for Storybook.</p>
    </div>
  ),
};
