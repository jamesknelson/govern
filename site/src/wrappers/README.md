Webpack loads all `.wrapper.js` files from directory as part of the main bundle, so that the wrapper files can be instantly loaded at runtime -- even if the files are not referenced directly.

Be careful of what you import from the wrappers! If you reference unnecessary components, you'll make every page needlessly heavy.