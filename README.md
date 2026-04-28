# Library Kiosk Sequence Diagram

## Description
This sequence diagram illustrates the process of returning a book through a library kiosk system.

## Normal Flow
The process starts when the student places a book on the scanner. The kiosk system scans the book ID using the book scanner and sends it to the library database for validation.
If the book is valid, the system proceeds to check the due date. When the book is returned on time, the library database updates the inventory successfully. 
After that, the kiosk system sends a confirmation message through the notification service. 
Finally, the book is placed on the shelf, and the system displays a "Return successful" message to the student.

## Alternative Flows
There are two alternative scenarios in this process. In the first scenario, if the book is invalid, the kiosk system displays an error message to the student and rejects the book. 
In the second scenario, if the book is overdue, the system calculates a fine using the fine calculator. 
The fine amount is then displayed to the student, who must confirm the payment. Once the payment is processed successfully by the payment system, 
the process continues normally with sending a confirmation message and completing the return procedure.
