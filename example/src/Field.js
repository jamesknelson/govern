import React from "react";
import { Subscribe } from "react-govern";

export const Field = ({ label, store, ...other }) => (
  <label>
    <span>{label}</span>
    <Subscribe to={store}>
      {(model, dispatch) => (
        <input
          {...other}
          value={model.value}
          onChange={e =>
            dispatch(() => {
              model.change(e.target.value);
            })
          }
        />
      )}
    </Subscribe>
  </label>
);
