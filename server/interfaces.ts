export interface ActionGetResponse {
    /** url of some descriptive image for the action */
    icon: string;
    /** title of the action */
    title: string;
    /** brief description of the action */
    description: string;
    /** text to be rendered on the action button */
    label: string;
    /** optional state for disabling the action button(s) */
    disabled?: boolean;
    /** optional list of related Actions */
    links?: {
        actions: LinkedAction[];
    };
    /** optional (non-fatal) error message */
    error?: ActionError;
}

export interface ActionError {
    /** non-fatal error message to be displayed to the user */
    message: string;
}

export interface LinkedAction {
    /** URL endpoint for an action */
    href: string;
    /** button text rendered to the user */
    label: string;
    /** Parameter to accept user input within an action */
    parameters?: [ActionParameter];
}

/** Parameter to accept user input within an action */
export interface ActionParameter {
    /** parameter name in url */
    name: string;
    /** placeholder text for the user input field */
    label?: string;
    /** declare if this field is required (defaults to `false`) */
    required?: boolean;
}

export interface ActionPostResponse {
    /** base64-encoded transaction */
    transaction: string;
    /** optional message, can be used to e.g. describe the nature of the transaction */
    message?: string;
}